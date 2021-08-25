import fs from "fs";
import path from "path";

import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";

import { interpret } from "./interpret";

export { downloadDatabase, unbundleDatabase, runQuery };

// Will create a directory 'database' in the current working directory
async function unbundleDatabase(dbZip: string): Promise<void> {
  const tmpDir = fs.mkdtempSync("tmp");
  // extractZip runs in `dest` (tmpDir) and so dbZip must be an absolute path
  const db = await tc.extractZip(path.resolve(dbZip), tmpDir);

  const dirs = fs.readdirSync(db);
  if (dirs.length !== 1 || !fs.statSync(path.join(db, dirs[0])).isDirectory()) {
    throw new Error(
      `Expected a single top-level folder in the database bundle ${db}, found ${dirs}`
    );
  }
  fs.renameSync(path.join(db, dirs[0]), "database");
}

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

  await exec.exec(codeql, [
    "query",
    "run",
    `--database=${database}`,
    `--output=${bqrs}`,
    queryFile
  ]);

  await exec.exec(codeql, [
    "bqrs",
    "decode",
    "--format=csv",
    `--output=${path.join("results", "results.csv")}`,
    bqrs
  ]);
  await exec.exec(codeql, [
    "bqrs",
    "decode",
    "--format=json",
    `--output=${json}`,
    "--entities=all",
    bqrs
  ]);
  const sourceLocationPrefix = JSON.parse(
    (await exec.getExecOutput(codeql, ["resolve", "database", database])).stdout
  ).sourceLocationPrefix;

  // This will load the whole result set into memory. Given that we just ran a
  // query, we probably have quite a lot of memory available. However, at some
  // point this is likely to break down. We could then look at using a streaming
  // parser such as http://oboejs.com/
  const jsonResults = JSON.parse(fs.readFileSync(json, "utf8"));

  const s = fs.createWriteStream(path.join("results", "results.md"), {
    encoding: "utf8"
  });

  await interpret(s, jsonResults, nwo, sourceLocationPrefix);
}

async function downloadDatabase(
  token: string,
  nwo: string,
  language: string
): Promise<string> {
  return tc.downloadTool(
    `https://api.github.com/repos/${nwo}/code-scanning/codeql/databases/${language}`,
    undefined,
    `token ${token}`
  );
}
