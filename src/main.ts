import fs from "fs";
import path from "path";

import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";

export { downloadDatabase, unbundleDatabase, runQuery };

// Will create a directory 'database' in the current working directory
async function unbundleDatabase(dbZip: string): Promise<void> {
  const tmpDir = fs.mkdtempSync("tmp");
  const cwd = process.cwd();
  console.log(cwd);
  const x = path.resolve(dbZip);
  console.log(x);
  try {
    const db = await tc.extractZip(dbZip, tmpDir);

    const dirs = fs.readdirSync(db);
    if (
      dirs.length !== 1 ||
      !fs.statSync(path.join(db, dirs[0])).isDirectory()
    ) {
      throw new Error(
        `Expected a single top-level folder in the database bundle ${db}, found ${dirs}`
      );
    }
    fs.renameSync(path.join(db, dirs[0]), "database");
  } finally {
    fs.rmdirSync(tmpDir);
  }
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
    queryFile,
  ]);

  await exec.exec(codeql, [
    "bqrs",
    "decode",
    "--format=csv",
    `--output=${path.join("results", "results.csv")}`,
    bqrs,
  ]);
  await exec.exec(codeql, [
    "bqrs",
    "decode",
    "--format=json",
    `--output=${json}`,
    "--entities=all",
    bqrs,
  ]);
  const sourceLocationPrefix = JSON.parse(
    (await exec.getExecOutput(codeql, ["resolve", "database", database])).stdout
  ).sourceLocationPrefix;
  await exec.exec(path.join(__dirname, "json2md.py"), [
    json,
    "--nwo",
    nwo,
    "--src",
    sourceLocationPrefix,
    `--output=${path.join("results", "results.md")}`,
  ]);
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

async function run(): Promise<void> {
  try {
    const query = core.getInput("query", { required: true });
    const language = core.getInput("language", { required: true });
    const nwo = core.getInput("repository", { required: true });
    const token = core.getInput("token", { required: true });
    const codeql = core.getInput("codeql", { required: true });

    core.setSecret(token);

    // 1. Use the GitHub API to download the database using token
    // TODO: Test this locally
    const dbZip = await downloadDatabase(token, nwo, language);
    await unbundleDatabase(dbZip);

    // 2. Run the query
    await runQuery(codeql, language, "database", query, nwo);

    await exec.exec("ls", ["-R"]);

    // 3. Upload the results as an artifact
    const artifactClient = artifact.create();
    await artifactClient.uploadArtifact(
      nwo.replace("/", "#"), // name
      ["results/results.bqrs", "results/results.csv", "results/results.md"], // files
      "results", // rootdirectory
      { continueOnError: false, retentionDays: 1 }
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

void run();
