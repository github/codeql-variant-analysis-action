import fs from "fs";
import { tmpdir } from "os";
import path from "path";
import { chdir, cwd } from "process";

import {
  endGroup,
  getInput,
  setFailed,
  setSecret,
  startGroup,
  info,
  warning,
} from "@actions/core";
import {
  find as findInToolCache,
  extractTar,
  HTTPError,
} from "@actions/tool-cache";
import JSZip from "jszip";

import { uploadArtifact } from "./azure-client";
import {
  downloadDatabase,
  getQueryPackInfo,
  runQuery,
  RunQueryResult,
} from "./codeql";
import { CodeqlCliServer } from "./codeql-cli";
import { setupCodeQLBundle } from "./codeql-setup";
import { getDefaultCliVersion } from "./codeql-version";
import { download } from "./download";
import {
  getPolicyForRepoArtifact,
  setVariantAnalysisFailed,
  setVariantAnalysisRepoInProgress,
  setVariantAnalysisRepoSucceeded,
} from "./gh-api-client";
import {
  getControllerRepoId,
  getInstructions,
  getRepos,
  getVariantAnalysisId,
  Repo,
} from "./inputs";

const shutdownHandlers: Array<() => void> = [];

async function run(): Promise<void> {
  const controllerRepoId = getControllerRepoId();
  const queryPackUrl = getInput("query_pack_url", { required: true });
  const language = getInput("language", { required: true });
  const repos: Repo[] = getRepos();
  const variantAnalysisId = getVariantAnalysisId();
  const instructions = await getInstructions(false);

  for (const repo of repos) {
    if (repo.downloadUrl) {
      setSecret(repo.downloadUrl);
    }
    if (repo.pat) {
      setSecret(repo.pat);
    }
  }

  startGroup("Setup CodeQL CLI");
  let codeqlBundlePath: string | undefined;

  if (instructions?.features) {
    const cliVersion = getDefaultCliVersion(instructions.features);
    if (cliVersion) {
      codeqlBundlePath = await setupCodeQLBundle(
        process.env.RUNNER_TEMP ?? tmpdir(),
        cliVersion,
      );
    } else {
      warning(
        `Unable to determine CodeQL version from feature flags, using latest version in tool cache`,
      );
    }
  }

  if (!codeqlBundlePath) {
    codeqlBundlePath = findInToolCache("CodeQL", "*");

    info(`Using CodeQL CLI from tool cache: ${codeqlBundlePath}`);
  }

  let codeqlCmd = path.join(codeqlBundlePath, "codeql", "codeql");
  if (process.platform === "win32") {
    codeqlCmd += ".exe";
  }

  endGroup();

  const curDir = cwd();

  let queryPackPath: string;
  try {
    // Download and extract the query pack.
    console.log("Getting query pack");
    const queryPackArchive = await download(queryPackUrl, "query_pack.tar.gz");
    queryPackPath = await extractTar(queryPackArchive);
  } catch (e: unknown) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : `${e}`;
    if (e instanceof HTTPError && e.httpStatusCode === 403) {
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

  const codeqlCli = new CodeqlCliServer(codeqlCmd);

  shutdownHandlers.push(() => {
    codeqlCli.shutdown();
  });

  const codeqlVersionInfo = await codeqlCli.run(["version", "--format=json"]);
  console.log(codeqlVersionInfo.stdout);

  const queryPackInfo = await getQueryPackInfo(codeqlCli, queryPackPath);

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
      const dbZipPath = path.resolve(dbZip);

      console.log("Running query");
      const runQueryResult = await runQuery(
        codeqlCli,
        dbZipPath,
        repo.nwo,
        queryPackInfo,
      );

      if (runQueryResult.resultCount > 0) {
        await uploadRepoResult(
          controllerRepoId,
          variantAnalysisId,
          repo,
          runQueryResult,
        );
      }

      await setVariantAnalysisRepoSucceeded(
        controllerRepoId,
        variantAnalysisId,
        repo.id,
        runQueryResult.sourceLocationPrefix,
        runQueryResult.resultCount,
        runQueryResult.databaseSHA || "HEAD",
      );
    } catch (e: unknown) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : `${e}`;
      if (e instanceof HTTPError && e.httpStatusCode === 403) {
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

  for (const relativePath of runQueryResult.bqrsFilePaths.relativeFilePaths) {
    const fullPath = path.join(
      runQueryResult.bqrsFilePaths.basePath,
      relativePath,
    );
    const bqrsFileContents = fs.createReadStream(fullPath);
    zip.file(relativePath, bqrsFileContents);
  }

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

void run().finally(() => {
  for (const handler of shutdownHandlers) {
    handler();
  }
});
