import fs from "fs";
import path from "path";

import { DownloadResponse } from "@actions/artifact";

import { QueryRunMetadata } from "./codeql";

export { createResultIndex };

export interface SuccessIndexItem {
  nwo: string;
  id: string;
  sha?: string;
  results_count: number;
  bqrs_file_size: number;
  sarif_file_size?: number;
}
export interface FailureIndexItem {
  nwo: string;
  id: string;
  error: string;
}

export interface ResultIndex {
  successes: SuccessIndexItem[];
  failures: FailureIndexItem[];
}

function createResultIndex(
  successArtifacts: DownloadResponse[],
  failureArtifacts: DownloadResponse[]
): ResultIndex {
  const successes: SuccessIndexItem[] = successArtifacts.map(function (
    response
  ) {
    const metadata = readMetadata(response);

    const id = response.artifactName;

    const bqrs_file_size = fs.statSync(
      path.join(response.downloadPath, "results.bqrs")
    ).size;
    let sarif_file_size: undefined | number = undefined;
    if (fs.existsSync(path.join(response.downloadPath, "results.sarif"))) {
      sarif_file_size = fs.statSync(
        path.join(response.downloadPath, "results.sarif")
      ).size;
    }
    const successIndexItem: SuccessIndexItem = {
      nwo: metadata.nwo,
      id,
      sha: metadata.sha,
      results_count: metadata.resultCount,
      bqrs_file_size,
      sarif_file_size,
    };
    return successIndexItem;
  });
  const failures: FailureIndexItem[] = failureArtifacts.map(function (
    response
  ) {
    // TODO: Make sure we can get metadata (i.e. nwo), even if the run failed
    const metadata = readMetadata(response);
    const nwo = metadata.nwo;

    // id is the artifactName without the "-error" suffix
    const id = response.artifactName.substring(
      0,
      response.artifactName.length - 6
    );
    const error = fs.readFileSync(
      path.join(response.downloadPath, "error.txt"),
      "utf-8"
    );
    const failureIndexItem: FailureIndexItem = {
      nwo,
      id,
      error,
    };
    return failureIndexItem;
  });
  return {
    successes,
    failures,
  };
}

function readMetadata(response: DownloadResponse): QueryRunMetadata {
  const metadata = fs.readFileSync(
    path.join(response.downloadPath, "metadata.json"),
    "utf8"
  );
  try {
    const metadataJson = JSON.parse(metadata);
    if (!metadataJson.nwo || !metadataJson.resultCount) {
      console.log(`metadata.json is missing nwo and resultCount properties.`);
    } else {
      return metadataJson;
    }
  } catch (error) {
    console.log(
      `Failed to parse metadata.json for ${response.artifactName}: ${error}`
    );
  }
  throw new Error(
    `Unable to read metadata from artifact ${response.artifactName}`
  );
}
