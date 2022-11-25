import fs from "fs";
import path from "path";

import { validateObject } from "./json-validation";

export interface QueryRunMetadata {
  nwo: string;
  resultCount?: number;
  sha?: string;
  sourceLocationPrefix?: string;
}

/**
 * Writes the metadata for a query run to a given file.
 */
export function writeQueryRunMetadataToFile(
  metadataFilePath: string,
  nwo: string,
  resultCount?: number,
  sha?: string,
  sourceLocationPrefix?: string
): void {
  const queryRunMetadata: QueryRunMetadata = {
    nwo,
    resultCount,
    sha,
    sourceLocationPrefix,
  };

  fs.writeFileSync(metadataFilePath, JSON.stringify(queryRunMetadata));
  return;
}

/**
 * Parses the metadata for a query run from a given file and returns it
 * as a `QueryRunMetadata` object.
 */
export function readQueryRunMetadataFromFile(
  downloadPath: string
): QueryRunMetadata {
  const metadataPath = path.join(downloadPath, "metadata.json");
  const metadata = validateObject(
    JSON.parse(fs.readFileSync(metadataPath, "utf8")),
    "queryRunMetadata"
  );
  return metadata;
}
