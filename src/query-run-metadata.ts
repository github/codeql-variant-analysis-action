import fs from "fs";

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
  sourceLocationPrefix?: string,
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
