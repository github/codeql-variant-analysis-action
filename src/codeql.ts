import fs from "fs";
import path from "path";

import { exec, getExecOutput } from "@actions/exec";
import { downloadTool } from "@actions/tool-cache";

import { interpret } from "./interpret";

export { downloadDatabase, runQuery };

// Will operate on the current working directory and create the following
// directories:
// * query/    (query.ql and any other supporting files)
// * results/  (results.{bqrs,csv,json,md})
async function runQuery(
  codeql: string,
  language: string,
  database: string,
  query: string,
  nwo: string
): Promise<void> {
  const bqrs = path.join("results", "results.bqrs");
  const json = path.join("results", "results.json");
  fs.mkdirSync("results");

  const queryDir = "query";
  fs.mkdirSync("query");
  const queryFile = path.join(queryDir, "query.ql");
  fs.writeFileSync(
    path.join(queryDir, "qlpack.yml"),
    `name: queries
version: 0.0.0
libraryPathDependencies: codeql-${language}`
  );
  fs.writeFileSync(queryFile, query);

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

  await interpret(s, jsonResults, nwo, sourceLocationPrefix);
}

async function downloadDatabase(
  repoId: number,
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

  return downloadTool(
    `https://api.github.com/repositories/${repoId}/code-scanning/codeql/databases/${language}`,
    `${repoId}.zip`,
    authHeader
  );
}
