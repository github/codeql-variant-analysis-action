import fs from "fs";
import path from "path";
import { chdir, cwd } from "process";

import {
  ArtifactClient,
  create as createArtifactClient,
} from "@actions/artifact";
import { getInput, saveState, setSecret, setFailed } from "@actions/core";
import { extractTar } from "@actions/tool-cache";
import JSZip from "jszip";

import { uploadArtifact } from "./azure-client";
import { downloadDatabase, runQuery, RunQueryResult } from "./codeql";
import { download } from "./download";
import {
  getPolicyForRepoArtifact,
  setVariantAnalysisFailed,
  setVariantAnalysisRepoInProgress,
  setVariantAnalysisRepoSucceeded,
} from "./gh-api-client";
import {
  getControllerRepoId,
  getRepos,
  getVariantAnalysisId,
  Repo,
} from "./inputs";
import { writeQueryRunMetadataToFile } from "./query-run-metadata";

async function run(): Promise<void> {
  const artifactClient = createArtifactClient();
  const controllerRepoId = getControllerRepoId();
  const queryPackUrl = getInput("query_pack_url", { required: true });
  const language = getInput("language", { required: true });
  const repos: Repo[] = getRepos();
  const codeql = getInput("codeql", { required: true });
  const variantAnalysisId = getVariantAnalysisId();
  const liveResults = !!variantAnalysisId;

  for (const repo of repos) {
    if (repo.downloadUrl) {
      setSecret(repo.downloadUrl);
    }
    if (repo.pat) {
      setSecret(repo.pat);
    }
  }

  const curDir = cwd();

  let queryPack: string;
  try {
    // Download and extract the query pack.
    console.log("Getting query pack");
    const queryPackArchive = await download(queryPackUrl, "query_pack.tar.gz");
    queryPack = await extractTar(queryPackArchive);
  } catch (error: any) {
    // Consider all repos to have failed
    setFailed(error.message);
    for (const repo of repos) {
      if (liveResults) {
        await setVariantAnalysisFailed(
          controllerRepoId,
          variantAnalysisId,
          repo.id,
          error.message
        );

        // Save that we have already completed this repo so we don't set the state
        // to failure in the post-action when a later repo fails.
        saveState(`repo_${repo.id}_completed`, "true");
      } else {
        const workDir = createTempRepoDir(curDir, repo);
        chdir(workDir);

        await uploadError(error, repo, artifactClient);

        chdir(curDir);
        fs.rmdirSync(workDir, { recursive: true });
      }
    }
    return;
  }

  for (const repo of repos) {
    // Create a new directory to contain all files created during analysis of this repo.
    const workDir = createTempRepoDir(curDir, repo);
    // Change into the new directory to further ensure that all created files go in there.
    chdir(workDir);

    try {
      if (liveResults) {
        await setVariantAnalysisRepoInProgress(
          controllerRepoId,
          variantAnalysisId,
          repo.id
        );
      }

      const dbZip = await getDatabase(repo, language);

      console.log("Running query");
      const runQueryResult = await runQuery(codeql, dbZip, repo.nwo, queryPack);

      if (liveResults) {
        await uploadRepoResult(
          controllerRepoId,
          variantAnalysisId,
          repo,
          runQueryResult
        );
        await setVariantAnalysisRepoSucceeded(
          controllerRepoId,
          variantAnalysisId,
          repo.id,
          runQueryResult.sourceLocationPrefix,
          runQueryResult.resultCount,
          runQueryResult.databaseSHA || "HEAD"
        );
      } else {
        await uploadRepoResultToActions(runQueryResult, artifactClient, repo);
      }
    } catch (error: any) {
      console.error(error);
      setFailed(error.message);

      if (liveResults) {
        await setVariantAnalysisFailed(
          controllerRepoId,
          variantAnalysisId,
          repo.id,
          error.message
        );
      } else {
        await uploadError(error, repo, artifactClient);
      }
    }

    // Save that we have already completed this repo so we don't set the state
    // to failure in the post-action when a later repo fails.
    saveState(`repo_${repo.id}_completed`, "true");

    // We can now delete the work dir. All required files have already been uploaded.
    chdir(curDir);
    fs.rmdirSync(workDir, { recursive: true });
  }
}

async function uploadRepoResultToActions(
  runQueryResult: RunQueryResult,
  artifactClient: ArtifactClient,
  repo: Repo
) {
  const filesToUpload = [
    runQueryResult.bqrsFilePath,
    runQueryResult.metadataFilePath,
  ];
  if (runQueryResult.sarifFilePath) {
    filesToUpload.push(runQueryResult.sarifFilePath);
  }
  console.log("Uploading artifact");
  await artifactClient.uploadArtifact(
    repo.id.toString(),
    filesToUpload,
    "results",
    { continueOnError: false }
  );
}

async function uploadRepoResult(
  controllerRepoId: number,
  variantAnalysisId: number,
  repo: Repo,
  runQueryResult: RunQueryResult
) {
  const artifactContents = await getArtifactContentsForUpload(runQueryResult);

  // Get policy for artifact upload
  const policy = await getPolicyForRepoArtifact(
    controllerRepoId,
    variantAnalysisId,
    repo.id,
    artifactContents.length
  );

  // Use Azure client for uploading to Azure Blob Storage
  await uploadArtifact(policy, artifactContents);
}

async function getArtifactContentsForUpload(
  runQueryResult: RunQueryResult
): Promise<Buffer> {
  const zip = new JSZip();

  if (runQueryResult.sarifFilePath) {
    const sarifFileContents = fs.createReadStream(runQueryResult.sarifFilePath);
    zip.file("results.sarif", sarifFileContents);
  } else {
    const bqrsFileContents = fs.createReadStream(runQueryResult.bqrsFilePath);
    zip.file("results.bqrs", bqrsFileContents);
  }

  return await zip.generateAsync({
    compression: "DEFLATE",
    type: "nodebuffer",
  });
}

async function getDatabase(repo: Repo, language: string) {
  console.log("Getting database");
  if (repo.downloadUrl) {
    // Use the provided signed URL to download the database
    return await download(repo.downloadUrl, `${repo.id}.zip`);
  } else {
    // Use the GitHub API to download the database using token
    return await downloadDatabase(repo.id, repo.nwo, language, repo.pat);
  }
}

// Write error messages to a file and upload as an artifact,
// so that the combine-results job "knows" about the failures.
async function uploadError(
  error: any,
  repo: Repo,
  artifactClient: ArtifactClient
) {
  fs.mkdirSync("errors");
  const errorFilePath = path.join("errors", "error.txt");
  fs.appendFileSync(errorFilePath, error.message);

  const metadataFilePath = path.join("errors", "metadata.json");

  writeQueryRunMetadataToFile(metadataFilePath, repo.nwo);

  await artifactClient.uploadArtifact(
    `${repo.id.toString()}-error`, // name
    [errorFilePath, metadataFilePath], // files
    "errors", // rootdirectory
    { continueOnError: false }
  );
}

/**
 * Creates a temporary directory for a given repository.
 * @param curDir The current directory.
 * @param repo The repository to create a temporary directory for.
 * @returns The path to the temporary directory.
 */
function createTempRepoDir(curDir: string, repo: Repo): string {
  const workDir = fs.mkdtempSync(path.join(curDir, repo.id.toString()));
  return workDir;
}

void run();
