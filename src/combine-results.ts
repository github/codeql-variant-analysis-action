import fs from "fs";
import path from "path";

import {
  ArtifactClient,
  create as createArtifactClient,
  DownloadResponse,
} from "@actions/artifact";
import { setFailed } from "@actions/core";
import { mkdirP } from "@actions/io";

import { createResultIndex } from "./interpret";

async function run(): Promise<void> {
  try {
    const artifactClient = createArtifactClient();
    const [resultArtifacts, errorArtifacts] = await downloadArtifacts(
      artifactClient
    );

    // Fail if there are no result artifacts
    if (resultArtifacts.length === 0) {
      setFailed("Unable to run query on any repositories.");
      return;
    }

    await mkdirP("results");
    await uploadResultIndex(resultArtifacts, errorArtifacts, artifactClient);
  } catch (error: any) {
    setFailed(error.message);
  }
}

async function downloadArtifacts(
  artifactClient: ArtifactClient
): Promise<[DownloadResponse[], DownloadResponse[]]> {
  await mkdirP("artifacts");
  const downloadResponse = await artifactClient.downloadAllArtifacts(
    "artifacts"
  );

  // See if there are any "error" artifacts and if so, let the user know in the issue
  const errorArtifacts = downloadResponse.filter((artifact) =>
    artifact.artifactName.includes("error")
  );

  // Result artifacts are the non-error artifacts
  const resultArtifacts = downloadResponse.filter(
    (artifact) => !errorArtifacts.includes(artifact)
  );

  return [resultArtifacts, errorArtifacts];
}

async function uploadResultIndex(
  resultArtifacts: DownloadResponse[],
  errorArtifacts: DownloadResponse[],
  artifactClient: ArtifactClient
) {
  const resultsIndex = createResultIndex(resultArtifacts, errorArtifacts);

  // Create the index.json file
  const resultIndexFile = path.join("results", "index.json");
  await fs.promises.writeFile(
    resultIndexFile,
    JSON.stringify(resultsIndex, null, 2)
  );

  await artifactClient.uploadArtifact(
    "result-index", // name
    [resultIndexFile], // files
    "results", // rootdirectory
    { continueOnError: false }
  );
}

void run();
