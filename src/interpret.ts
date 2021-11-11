import { once } from "events";
import fs from "fs";
import path from "path";
import stream from "stream";
import { promisify } from "util";

import { DownloadResponse } from "@actions/artifact";

export {
  entityToString,
  toTableRow,
  problemQueryMessage,
  interpret,
  createResultIndex,
  ResultIndexItem,
};

// Methods in this file consume the output from `codeql bqrs decode --format=json`.
// For example:
//
// {
//   "id": 7661,
//   "label": "CERTSTORE_DOESNT_WORK_ON_LINIX",
//   "url": {
//     "uri": "file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go",
//     "startLine": 8,
//     "startColumn": 2,
//     "endLine": 8,
//     "endColumn": 31
//   }
// }

// If e is an object representing a single entity, turn it into a markdown representation.
function entityToString(e: any, nwo: string, src: string, ref: string): string {
  // Handle integers, strings, and anything else we haven't seen yet
  if (typeof e !== "object") {
    return `${e}`;
  }

  let url = getEntityURL(e, nwo, src, ref);

  // For now we produce a link even if the target is outside the source archive
  // so we don't just throw the location away.
  url = `[${e.label}](${url})`;

  return url;
}

// If e is an object representing a single entity, turn it into a link to
// the github.com code viewer.
function getEntityURL(e: any, nwo: string, src: string, ref: string): string {
  let url = `${e.url.uri}#L${e.url.startLine}`;
  if (nwo !== undefined && src !== undefined && url.startsWith(`file:${src}`)) {
    // Make path relative
    const relative = url.substr(`file:${src}`.length);
    url = `https://github.com/${nwo}/blob/${ref}${relative}`;
  }
  return url;
}

// Returns the formatted message for a problem query, with any placeholders filled in.
function problemQueryMessage(
  tuple: any,
  nwo: string,
  src: string,
  ref: string
): string {
  // Start with just the raw message, and then fill in any placeholders
  let message = tuple[1] as string;

  // The index in the message of the next "$@", or -1 if there are no more placeholders to fill
  let nextMessageDollarAtIndex = message.indexOf("$@");
  // The index in the tuple of the next placeholder to take
  let nextPlaceholderTupleIndex = 2;
  while (
    nextMessageDollarAtIndex !== -1 &&
    nextPlaceholderTupleIndex < tuple.length - 1
  ) {
    const linkUrl = getEntityURL(
      tuple[nextPlaceholderTupleIndex],
      nwo,
      src,
      ref
    );
    const linkText = tuple[nextPlaceholderTupleIndex + 1];
    const link = `[${linkText}](${linkUrl})`;

    message =
      message.substring(0, nextMessageDollarAtIndex) +
      link +
      message.substring(nextMessageDollarAtIndex + 2);

    // Search for the next $@ starting after the link we just inserted so as not to recurse
    nextMessageDollarAtIndex = message.indexOf(
      "$@",
      nextMessageDollarAtIndex + link.length
    );
    nextPlaceholderTupleIndex += 2;
  }

  return message;
}

// Returns the given set of strings formatted as a row of a markdown table
function toTableRow(data: string[]): string {
  return `| ${data.join(" | ")} |\n`;
}

// Returns the second row of a markdown table, between the column names and the body
function tableDashesRow(numColumns: number): string {
  return toTableRow(Array(numColumns).fill("-"));
}

const finished = promisify(stream.finished);

async function write(output: stream.Writable, s: string) {
  if (!output.write(s)) {
    await once(output, "drain");
  }
}

async function interpret(
  output: stream.Writable,
  results: any,
  nwo: string,
  compatibleQueryKinds: string[],
  src: string,
  ref: string
): Promise<void> {
  // Convert a Windows-style srcLocation to Unix-style
  src = src.replace(/\\/g, "/");
  if (!src.startsWith("/")) {
    src = `/${src}`;
  }

  await write(output, `## ${nwo}\n\n`);

  if (compatibleQueryKinds.includes("Problem")) {
    // Output as problem with placeholders
    const colNames = ["-", "Message"];
    await write(output, toTableRow(colNames));
    await write(output, tableDashesRow(colNames.length));

    for (const tuple of results["#select"]["tuples"]) {
      const entityCol = entityToString(tuple[0], nwo, src, ref);
      const messageCol = problemQueryMessage(tuple, nwo, src, ref);
      await write(output, toTableRow([entityCol, messageCol]));
    }
  } else {
    // Output raw table
    const colNames = results["#select"]["columns"].map((c) => c.name || "-");
    await write(output, toTableRow(colNames));
    await write(output, tableDashesRow(colNames.length));

    for (const tuple of results["#select"]["tuples"]) {
      const row = tuple.map((e) => entityToString(e, nwo, src, ref));
      await write(output, toTableRow(row));
    }
  }

  output.end();
  return finished(output);
}

interface ResultIndexItem {
  nwo: string;
  id: string;
  results_count: number;
  bqrs_file_size: number;
  sarif_file_size?: number;
}
async function createResultIndex(
  resultArtifacts: DownloadResponse[]
): Promise<ResultIndexItem[]> {
  return await Promise.all(
    resultArtifacts.map(async function (response) {
      const nwo = fs.readFileSync(
        path.join(response.downloadPath, "nwo.txt"),
        "utf-8"
      );
      const id = response.artifactName;
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
      const resultIndexItem: ResultIndexItem = {
        nwo,
        id,
        results_count,
        bqrs_file_size,
        sarif_file_size,
      };
      return resultIndexItem;
    })
  );
}
