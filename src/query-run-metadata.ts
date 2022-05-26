import fs from "fs";
import path from "path";

export interface QueryRunMetadata {
  nwo: string;
  resultCount?: number;
  sha?: string;
}

/**
 * Writes the metadata for a query run to a given file.
 */
export function writeQueryRunMetadataToFile(
  metadataFilePath: string,
  nwo: string,
  resultCount?: number,
  sha?: string
): void {
  const queryRunMetadata: QueryRunMetadata = {
    nwo,
    resultCount,
    sha,
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
  try {
    const metadata = fs.readFileSync(
      path.join(downloadPath, "metadata.json"),
      "utf8"
    );
    const metadataJson = JSON.parse(metadata);
    if (!metadataJson.nwo) {
      console.log(`metadata.json is missing nwo property.`);
    } else {
      return metadataJson;
    }
  } catch (error) {
    console.log(`Failed to parse metadata.json: ${error}`);
  }
  throw new Error("Unable to read metadata from artifact");
}
