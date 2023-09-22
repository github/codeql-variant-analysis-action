import fs from "fs";
import path from "path";
import { chdir, cwd } from "process";

import { getInput, setSecret, setFailed } from "@actions/core";
import { extractTar, HTTPError } from "@actions/tool-cache";
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

async function run(): Promise<void> {
  const controllerRepoId = getControllerRepoId();
  const queryPackUrl = getInput("query_pack_url", { required: true });
  const language = getInput("language", { required: true });
  const repos: Repo[] = getRepos();
  const codeql = getInput("codeql", { required: true });
  const variantAnalysisId = getVariantAnalysisId();

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
  } catch (error: unknown) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : `${error}`;
    if (error instanceof HTTPError && error.httpStatusCode === 403) {
      setFailed(
        `${errorMessage}. The query pack is only available for 24 hours. To retry, create a new variant analysis.`,
      );
    } else {
      setFailed(errorMessage);
    }
    // Consider all repos to have failed
    for (const repo of repos) {
      await setVariantAnalysisFailed(
        controllerRepoId,
        variantAnalysisId,
        repo.id,
        errorMessage,
      );
    }
    return;
  }

  for (const repo of repos) {
    // Create a new directory to contain all files created during analysis of this repo.
    const workDir = createTempRepoDir(curDir, repo);
    // Change into the new directory to further ensure that all created files go in there.
    chdir(workDir);

    try {
      await setVariantAnalysisRepoInProgress(
        controllerRepoId,
        variantAnalysisId,
        repo.id,
      );

      const dbZip = await getDatabase(repo, language);

      console.log("Running query");
      const runQueryResult = await runQuery(codeql, dbZip, repo.nwo, queryPack);

      await uploadRepoResult(
        controllerRepoId,
        variantAnalysisId,
        repo,
        runQueryResult,
      );
      await setVariantAnalysisRepoSucceeded(
        controllerRepoId,
        variantAnalysisId,
        repo.id,
        runQueryResult.sourceLocationPrefix,
        runQueryResult.resultCount,
        runQueryResult.databaseSHA || "HEAD",
      );
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : `${error}`;
      if (error instanceof HTTPError && error.httpStatusCode === 403) {
        setFailed(
          `${errorMessage}. Database downloads are only available for 24 hours. To retry, create a new variant analysis.`,
        );
      } else {
        setFailed(errorMessage);
      }

      await setVariantAnalysisFailed(
        controllerRepoId,
        variantAnalysisId,
        repo.id,
        errorMessage,
      );
    }
    // We can now delete the work dir. All required files have already been uploaded.
    chdir(curDir);
    fs.rmSync(workDir, { recursive: true });
  }
}

async function uploadRepoResult(
  controllerRepoId: number,
  variantAnalysisId: number,
  repo: Repo,
  runQueryResult: RunQueryResult,
) {
  const artifactContents = await getArtifactContentsForUpload(runQueryResult);

  // Get policy for artifact upload
  const policy = await getPolicyForRepoArtifact(
    controllerRepoId,
    variantAnalysisId,
    repo.id,
    artifactContents.length,
  );

  // Use Azure client for uploading to Azure Blob Storage
  await uploadArtifact(policy, artifactContents);
}

async function getArtifactContentsForUpload(
  runQueryResult: RunQueryResult,
): Promise<Buffer> {
  const zip = new JSZip();

  if (runQueryResult.sarifFilePath) {
    const sarifFileContents = fs.createReadStream(runQueryResult.sarifFilePath);
    zip.file("results.sarif", sarifFileContents);
  }
  const bqrsFileContents = fs.createReadStream(runQueryResult.bqrsFilePath);
  zip.file("results.bqrs", bqrsFileContents);

  return await zip.generateAsync({
    compression: "DEFLATE",
    type: "nodebuffer",
  });
}

async function getDatabase(repo: Repo, language: string) {
  console.log(`Getting database for ${repo.nwo}`);
  if (repo.downloadUrl) {
    // Use the provided signed URL to download the database
    return await download(repo.downloadUrl, `${repo.id}.zip`);
  } else {
    // Use the GitHub API to download the database using token
    return await downloadDatabase(repo.id, repo.nwo, language, repo.pat);
  }
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
