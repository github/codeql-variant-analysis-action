import fs from "fs";
import path from "path";

import { DownloadResponse } from "@actions/artifact";

import { readQueryRunMetadataFromFile } from "./query-run-metadata";

export { createResultIndex };

/* eslint-disable @typescript-eslint/naming-convention */
export interface SuccessIndexItem {
  nwo: string;
  id: string;
  sha?: string;
  results_count: number;
  bqrs_file_size: number;
  sarif_file_size?: number;
  source_location_prefix: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

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
    console.log(`Reading metadata from artifact: ${response.artifactName}`);
    const metadata = readQueryRunMetadataFromFile(response.downloadPath);
    if (metadata.resultCount === undefined || metadata.resultCount === null) {
      throw new Error(`metadata.json is missing resultCount property.`);
    }
    if (!metadata.sourceLocationPrefix) {
      throw new Error(
        `metadata.json is missing sourceLocationPrefix property.`
      );
    }

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
    /* eslint-disable @typescript-eslint/naming-convention */
    const successIndexItem: SuccessIndexItem = {
      nwo: metadata.nwo,
      id,
      sha: metadata.sha,
      results_count: metadata.resultCount,
      bqrs_file_size,
      sarif_file_size,
      source_location_prefix: metadata.sourceLocationPrefix,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    return successIndexItem;
  });
  const failures: FailureIndexItem[] = failureArtifacts.map(function (
    response
  ) {
    console.log(`Reading metadata from artifact: ${response.artifactName}`);
    const metadata = readQueryRunMetadataFromFile(response.downloadPath);
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
