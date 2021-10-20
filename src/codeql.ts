import fs from "fs";
import path from "path";

import { exec, getExecOutput } from "@actions/exec";

import { downloadDatabaseFile } from "./download-database";
import { interpret } from "./interpret";

export { downloadDatabase, runQuery };

// Will operate on the current working directory and create the following
// directories:
// * query/    (query.ql and any other supporting files)
// * results/  (results.{bqrs,csv,json,md} and nwo.txt)
async function runQuery(
  codeql: string,
  language: string,
  database: string,
  nwo: string,
  query?: string,
  queryPack?: string
): Promise<void> {
  const bqrs = path.join("results", "results.bqrs");
  const json = path.join("results", "results.json");
  fs.mkdirSync("results");
  fs.writeFileSync(path.join("results", "nwo.txt"), nwo);

  let queryFile: string;
  if (query !== undefined) {
    const queryDir = "query";
    fs.mkdirSync("query");
    queryFile = path.join(queryDir, "query.ql");
    fs.writeFileSync(
      path.join(queryDir, "qlpack.yml"),
      `name: queries
version: 0.0.0
libraryPathDependencies: codeql-${language}`
    );
    fs.writeFileSync(queryFile, query);
  } else if (queryPack !== undefined) {
    queryFile = path.join(queryPack, "query.ql");
  } else {
    throw new Error("Exactly one of 'query' and 'queryPack' must be set");
  }

  await exec(codeql, ["database", "unbundle", database, "--name=db"]);

  await exec(codeql, [
    "query",
    "run",
    `--database=db`,
    `--output=${bqrs}`,
    queryFile,
  ]);

  await Promise.all([
    exec(codeql, [
      "bqrs",
      "decode",
      "--format=csv",
      `--output=${path.join("results", "results.csv")}`,
      bqrs,
    ]),
    exec(codeql, [
      "bqrs",
      "decode",
      "--format=json",
      `--output=${json}`,
      "--entities=all",
      bqrs,
    ]),
  ]);

  const sourceLocationPrefix = JSON.parse(
    (await getExecOutput(codeql, ["resolve", "database", "db"])).stdout
  ).sourceLocationPrefix;

  // This will load the whole result set into memory. Given that we just ran a
  // query, we probably have quite a lot of memory available. However, at some
  // point this is likely to break down. We could then look at using a streaming
  // parser such as http://oboejs.com/
  const jsonResults = JSON.parse(fs.readFileSync(json, "utf8"));

  const s = fs.createWriteStream(path.join("results", "results.md"), {
    encoding: "utf8",
  });

  await interpret(s, jsonResults, nwo, sourceLocationPrefix, "HEAD");
}

async function downloadDatabase(
  repoId: number,
  repoName: string,
  language: string,
  signedAuthToken?: string,
  pat?: string
): Promise<string> {
  let authHeader: string | undefined = undefined;
  if (signedAuthToken) {
    authHeader = `RemoteAuth ${signedAuthToken}`;
  } else if (pat) {
    authHeader = `token ${pat}`;
  }

  try {
    return await downloadDatabaseFile(
      `https://api.github.com/repositories/${repoId}/code-scanning/codeql/databases/${language}`,
      `${repoId}.zip`,
      authHeader
    );
  } catch (error: any) {
    console.log("Error while downloading database");
    if (
      error.httpStatusCode === 404 &&
      error.httpMessage.includes("No database available for")
    ) {
      throw new Error(
        `Language mismatch: The query targets ${language}, but the repository "${repoName}" has no CodeQL database available for that language.`
      );
    } else {
      throw error;
    }
  }
}
