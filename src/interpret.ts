import fs from "fs";
import path from "path";

import { DownloadResponse } from "@actions/artifact";

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
    const nwo = fs.readFileSync(
      path.join(response.downloadPath, "nwo.txt"),
      "utf-8"
    );
    const id = response.artifactName;
    let sha: string | undefined = undefined;
    const shaPath = path.join(response.downloadPath, "sha.txt");
    try {
      sha = fs.readFileSync(shaPath, "utf-8");
    } catch (err) {
      console.log(
        `Couldn't read sha.txt from ${response.downloadPath}: ${err}`
      );
    }
    const results_count = parseInt(
      fs.readFileSync(
        path.join(response.downloadPath, "resultcount.txt"),
        "utf-8"
      ),
      10
    );
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
      nwo,
      id,
      sha,
      results_count,
      bqrs_file_size,
      sarif_file_size,
    };
    return successIndexItem;
  });
  const failures: FailureIndexItem[] = failureArtifacts.map(function (
    response
  ) {
    const nwo = fs.readFileSync(
      path.join(response.downloadPath, "nwo.txt"),
      "utf-8"
    );
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
