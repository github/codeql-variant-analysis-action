import fs from "fs";
import path from "path";

import { exec, getExecOutput } from "@actions/exec";
import * as yaml from "js-yaml";

import { download } from "./download";
import { interpret } from "./interpret";

export { downloadDatabase, runQuery, getDatabaseSHA };

/**
 * Run a query. Will operate on the current working directory and create the following directories:
 * - query/    (query.ql and any other supporting files)
 * - results/  (results.{bqrs,csv,json,md} and nwo.txt)
 *
 * @param     codeql              The path to the codeql binary
 * @param     language            The language of the query (can be removed once we only use query packs)
 * @param     database            The path to the bundled database zip file
 * @param     nwo                 The name of the repository
 * @param     query?              The query to run (specify this XOR a query pack)
 * @param     queryPack?          The path to the query pack (specify this XOR a query)
 * @returns   Promise<string[]>   Resolves when the query has finished running.
 *                                Returns a list of files that have been created.
 */
async function runQuery(
  codeql: string,
  language: string,
  database: string,
  nwo: string,
  query?: string,
  queryPack?: string
): Promise<string[]> {
  const bqrs = path.join("results", "results.bqrs");
  fs.mkdirSync("results");
  const nwoFile = path.join("results", "nwo.txt");
  fs.writeFileSync(nwoFile, nwo);

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

  const databaseName = "db";
  await exec(codeql, [
    "database",
    "unbundle",
    database,
    `--name=${databaseName}`,
  ]);

  const databaseSHA = getDatabaseSHA(databaseName);

  await exec(codeql, [
    "query",
    "run",
    `--database=db`,
    `--output=${bqrs}`,
    queryFile,
  ]);

  const bqrsInfo = await getBqrsInfo(codeql, bqrs);
  const compatibleQueryKinds = bqrsInfo.compatibleQueryKinds;

  const outputPromises: Array<Promise<string[]>> = [
    outputCsv(codeql, bqrs),
    outputMd(codeql, bqrs, nwo, databaseSHA, compatibleQueryKinds),
    outputSarif(codeql, bqrs, compatibleQueryKinds),
    outputResultCount(bqrsInfo),
  ];

  return [bqrs, nwoFile].concat(...(await Promise.all(outputPromises)));
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
    return await download(
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

interface BQRSInfo {
  resultSets: Array<{
    name: string;
    rows: number;
  }>;
  compatibleQueryKinds: string[];
}

// Calls `bqrs info` for the given bqrs file and returns JSON output
async function getBqrsInfo(codeql: string, bqrs: string): Promise<BQRSInfo> {
  const bqrsInfoOutput = await getExecOutput(codeql, [
    "bqrs",
    "info",
    "--format=json",
    bqrs,
  ]);
  if (bqrsInfoOutput.exitCode !== 0) {
    throw new Error(
      `Unable to run codeql bqrs info. Exit code: ${bqrsInfoOutput.exitCode}`
    );
  }
  return JSON.parse(bqrsInfoOutput.stdout, (_, value) => {
    if (value && typeof value === "object") {
      for (const k in value) {
        if (k.match(/-./)) {
          const l = k.replace(/-./g, (x) => x[1].toUpperCase());
          value[l] = value[k];
          delete value[k];
        }
      }
    }
    return value;
  });
}

// Generates results.csv from the given bqrs file
async function outputCsv(codeql: string, bqrs: string): Promise<string[]> {
  const csv = path.join("results", "results.csv");
  await exec(codeql, [
    "bqrs",
    "decode",
    "--format=csv",
    `--output=${csv}`,
    bqrs,
  ]);
  return [csv];
}

// Generates results.md from the given bqrs file
async function outputMd(
  codeql: string,
  bqrs: string,
  nwo: string,
  databaseSHA: string,
  compatibleQueryKinds: string[]
): Promise<string[]> {
  const json = path.join("results", "results.json");
  await exec(codeql, [
    "bqrs",
    "decode",
    "--format=json",
    `--output=${json}`,
    "--entities=all",
    bqrs,
  ]);

  const sourceLocationPrefix = JSON.parse(
    (await getExecOutput(codeql, ["resolve", "database", "db"])).stdout
  ).sourceLocationPrefix;

  // This will load the whole result set into memory. Given that we just ran a
  // query, we probably have quite a lot of memory available. However, at some
  // point this is likely to break down. We could then look at using a streaming
  // parser such as http://oboejs.com/
  const jsonResults = JSON.parse(fs.readFileSync(json, "utf8"));

  const md = path.join("results", "results.md");
  const s = fs.createWriteStream(md, {
    encoding: "utf8",
  });

  await interpret(
    s,
    jsonResults,
    nwo,
    compatibleQueryKinds,
    sourceLocationPrefix,
    databaseSHA
  );
  return [md];
}

// Generates results.sarif from the given bqrs file, if query kind supports it
async function outputSarif(
  codeql: string,
  bqrs: string,
  compatibleQueryKinds: string[]
): Promise<string[]> {
  let kind: string;
  if (compatibleQueryKinds.includes("Problem")) {
    kind = "problem";
  } else if (compatibleQueryKinds.includes("PathProblem")) {
    kind = "path-problem";
  } else {
    // Cannot generate sarif for this query kind
    return [];
  }

  const sarif = path.join("results", "results.sarif");
  await exec(codeql, [
    "bqrs",
    "interpret",
    "--format=sarif-latest",
    `--output=${sarif}`,
    `-t=kind=${kind}`,
    "-t=id=remote-query",
    bqrs,
  ]);
  return [sarif];
}

// Generates results count
async function outputResultCount(bqrsInfo: BQRSInfo): Promise<string[]> {
  const count = path.join("results", "resultcount.txt");
  // find the rows for the result set with name "#select"
  const selectResultSet = bqrsInfo.resultSets.find(
    (resultSet) => resultSet.name === "#select"
  );
  if (!selectResultSet) {
    throw new Error("No result set named #select");
  }
  fs.writeFileSync(count, selectResultSet.rows.toString(), "utf8");
  return [count];
}

interface DatabaseMetadata {
  creationMetadata?: {
    sha?: string;
  };
}

/**
 * Gets the commit SHA that a database was created from (if the database was created from a git repo).
 * This information is available from CodeQL CLI version 2.7.2 onwards.
 *
 * @param database The name of the database.
 * @returns The commit SHA that the database was created from, or "HEAD" if we can't find the SHA.
 */
function getDatabaseSHA(database: string): string {
  let metadata: DatabaseMetadata | undefined;
  try {
    metadata = yaml.load(
      fs.readFileSync(path.join(database, "codeql-database.yml"), "utf8")
    ) as DatabaseMetadata | undefined;
  } catch (error) {
    console.log(`Unable to read codeql-database.yml: ${error}`);
    return "HEAD";
  }

  const sha = metadata?.creationMetadata?.sha;

  if (sha) {
    return sha;
  } else {
    console.log(
      "Unable to get exact commit SHA for the database. Linking to HEAD commit instead."
    );
    return "HEAD";
  }
}
