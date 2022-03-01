import { once } from "events";
import fs from "fs";
import path from "path";
import stream from "stream";
import { promisify } from "util";

import { DownloadResponse } from "@actions/artifact";
import { context } from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
type Octokit = InstanceType<typeof GitHub>;

export {
  entityToString,
  escapeMarkdown,
  toTableRow,
  problemQueryMessage,
  interpret,
  createResultIndex,
  createResultsMd,
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
    return escapeMarkdown(`${e}`);
  }

  const text = escapeMarkdown(e.label);

  if (e["url"] !== undefined) {
    // For now we produce a link even if the target is outside the source archive
    // so we don't just throw the location away.
    return `[${text}](${getEntityURL(e, nwo, src, ref)})`;
  }

  return text;
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

// Replace markdown special characters with the corresponding HTML entities
// This is the set \`*_{}[]()#+-.! plus <> for inline HTML
function escapeMarkdown(s: string): string {
  let result = "";
  for (const c of s) {
    if (c.match(/[\\`*_{}[\]()#+.!<>-]/)) {
      result += `&#${c.charCodeAt(0)};`;
    } else {
      result += c;
    }
  }
  return result;
}

// Returns the formatted message for a problem query, with any placeholders filled in.
function problemQueryMessage(
  tuple: any,
  nwo: string,
  src: string,
  ref: string
): string {
  // Start with just the raw message, and then fill in any placeholders. We
  // escape the full message here and then the placeholder replacement text
  // later before inserting it. This works because '$@' doesn't contain a
  // special markdown character. We don't want to wait until the end because
  // then we would break the replacement link targets.
  let message = escapeMarkdown(tuple[1] as string);

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
    const linkText = escapeMarkdown(tuple[nextPlaceholderTupleIndex + 1]);
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

  let numResults: number;
  let numResultsOutput: number;

  if (compatibleQueryKinds.includes("Problem")) {
    // Output as problem with placeholders
    const generateNextRow = function* generateNextRow() {
      for (const tuple of results["#select"]["tuples"]) {
        const entityCol = entityToString(tuple[0], nwo, src, ref);
        const messageCol = problemQueryMessage(tuple, nwo, src, ref);
        yield toTableRow([entityCol, messageCol]);
      }
      return undefined;
    };
    numResults = results["#select"]["tuples"].length;
    numResultsOutput = await writeTableContents(
      output,
      ["-", "Message"],
      generateNextRow()
    );
  } else {
    // Output raw table
    const colNames = results["#select"]["columns"].map((c) =>
      c.name ? escapeMarkdown(c.name) : "-"
    );
    const generateNextRow = function* generateNextRow() {
      for (const tuple of results["#select"]["tuples"]) {
        const row = tuple.map((e) => entityToString(e, nwo, src, ref));
        yield toTableRow(row);
      }
      return undefined;
    };
    numResults = results["#select"]["tuples"].length;
    numResultsOutput = await writeTableContents(
      output,
      colNames,
      generateNextRow()
    );
  }

  if (numResultsOutput < numResults) {
    await write(
      output,
      `\n\nResults were truncated due to issue comment size limits. Showing ${numResultsOutput} out of ${numResults} results.`
    );
  }

  output.end();
  return finished(output);
}

// Outputs a table to the writable stream.
// Avoids going over the issue comment length limit and will truncate results if necessary.
// Returns the number of rows written to the output, excluding any header rows.
async function writeTableContents(
  output: stream.Writable,
  colNames: string[],
  nextRow: Generator<string, undefined, unknown>
): Promise<number> {
  // Issue comment limit is 65536 characters.
  // But leave a bit of buffer to account for the comment title and truncation warning text.
  const maxCharactersInComment = 64000;

  let charactersWritten = 0;

  const headerRow = toTableRow(colNames);
  const dashesRow = tableDashesRow(colNames.length);

  // Check we're not already going over the character limit due to an excessive number of columns
  if (headerRow.length + dashesRow.length > maxCharactersInComment) {
    // Output as much as we can, just so the user can see what they were missing / why it went wrong
    await write(
      output,
      (headerRow + dashesRow).substr(0, maxCharactersInComment)
    );
    return 0;
  }

  await write(output, headerRow);
  await write(output, dashesRow);
  charactersWritten += headerRow.length + dashesRow.length;

  let rowsOutput = 0;
  for (let curr = nextRow.next(); !curr.done; curr = nextRow.next()) {
    const row = curr.value;
    if (charactersWritten + row.length < maxCharactersInComment) {
      await write(output, row);
      charactersWritten += row.length;
      rowsOutput += 1;
    } else {
      break;
    }
  }

  return rowsOutput;
}

async function createResultsMd(
  octokit: Octokit,
  issue_number: number,
  resultArtifacts: DownloadResponse[]
): Promise<string> {
  // Read all of the nwo.txt and resultcount.txt files and collect the data
  // into an array for easy access.
  const results: Array<{
    nwo: string;
    resultCount: number;
    downloadPath: string;
  }> = await Promise.all(
    resultArtifacts.map(async (response) => {
      const nwo = await fs.promises.readFile(
        path.join(response.downloadPath, "nwo.txt"),
        "utf-8"
      );
      const resultCount = parseInt(
        await fs.promises.readFile(
          path.join(response.downloadPath, "resultcount.txt"),
          "utf-8"
        ),
        10
      );
      return {
        nwo,
        resultCount,
        downloadPath: response.downloadPath,
      };
    })
  );

  // Place repositories with high numbers of results at the top
  results.sort((a, b) => b.resultCount - a.resultCount);

  // Only post up to a fixed number of comments
  const maxNumComments = 50;
  let numComments = 0;
  let reposWithResults = 0;

  // Post issue comments and construct the main issue body
  const resultsMdLines: string[] = [];
  for (const result of results) {
    if (result.resultCount > 0) {
      reposWithResults += 1;
      if (numComments < maxNumComments) {
        const md = path.join(result.downloadPath, "results.md");
        const comment = await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number,
          body: await fs.promises.readFile(md, "utf8"),
        });
        numComments += 1;
        resultsMdLines.push(
          `| ${result.nwo} | [${result.resultCount} result(s)](${comment.data.html_url}) |`
        );
        // Wait very slightly after posting each comment to avoid hitting rate limits
        await timeout(1000);
      } else {
        resultsMdLines.push(
          `| ${result.nwo} | ${result.resultCount} result(s) |`
        );
      }
    } else {
      resultsMdLines.push(`| ${result.nwo} | _No results_ |`);
    }
  }
  const resultsMd = resultsMdLines.join("\n");

  // If we couldn't post some comments then add a warning to the top of the body
  let numCommentsWarning = "";
  if (numComments === maxNumComments) {
    numCommentsWarning = `Due to the number of repositories with results, not all results are included as issue comments. Showing results in comments for ${numComments} out of ${reposWithResults} repositories with results. For full results please refer to workflow artifacts.\n\n`;
  }

  return `# Results\n\n${numCommentsWarning}|Repository|Results|\n|---|---|\n${resultsMd}`;
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SuccessIndexItem {
  nwo: string;
  id: string;
  sha: string;
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
    const sha = fs.readFileSync(
      path.join(response.downloadPath, "sha.txt"),
      "utf-8"
    );
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
