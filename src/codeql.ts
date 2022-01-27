import fs from "fs";
import path from "path";

import { exec, getExecOutput } from "@actions/exec";
import * as yaml from "js-yaml";

import { deserialize } from "./deserialize";
import { download } from "./download";
import { interpret } from "./interpret";

export {
  BQRSInfo,
  downloadDatabase,
  runQuery,
  getBqrsInfo,
  getDatabaseMetadata,
  getRemoteQueryPackDefaultQuery,
};

// This name must match that used by the vscode extension when creating the pack.
const REMOTE_QUERY_PACK_NAME = "codeql-remote/query";

/**
 * Run a query. Will operate on the current working directory and create the following directories:
 * - query/    (query.ql and any other supporting files)
 * - results/  (results.{bqrs,csv,json,md} and nwo.txt)
 *
 * @param     codeql              The path to the codeql binary
 * @param     database            The path to the bundled database zip file
 * @param     nwo                 The name of the repository
 * @param     queryPack           The path to the query pack
 * @returns   Promise<string[]>   Resolves when the query has finished running.
 *                                Returns a list of files that have been created.
 */
async function runQuery(
  codeql: string,
  database: string,
  nwo: string,
  queryPack: string
): Promise<string[]> {
  const bqrs = path.join("results", "results.bqrs");
  fs.mkdirSync("results");
  const nwoFile = path.join("results", "nwo.txt");
  fs.writeFileSync(nwoFile, nwo);

  const databaseName = "db";
  await exec(codeql, [
    "database",
    "unbundle",
    database,
    `--name=${databaseName}`,
  ]);

  const dbMetadata = getDatabaseMetadata(databaseName);
  console.log(
    `This database was created using CodeQL CLI version ${dbMetadata.creationMetadata?.cliVersion}`
  );

  await exec(codeql, [
    "database",
    "run-queries",
    "--additional-packs",
    queryPack,
    "--",
    databaseName,
    REMOTE_QUERY_PACK_NAME,
  ]);

  let cur = `${databaseName}/results`;
  let entries: fs.Dirent[];
  while (
    (entries = fs.readdirSync(cur, { withFileTypes: true })) &&
    entries.length === 1 &&
    entries[0].isDirectory()
  ) {
    cur = path.join(cur, entries[0].name);
  }

  if (entries.length !== 1) {
    throw new Error(`Expected a single file in ${cur}, found: ${entries}`);
  }

  const entry = entries[0];
  if (!entry.isFile() || !entry.name.endsWith(".bqrs")) {
    throw new Error(`Unexpected file in ${cur}: ${entry.name}`);
  }

  fs.renameSync(path.join(cur, entry.name), bqrs);

  const bqrsInfo = await getBqrsInfo(codeql, bqrs);
  const compatibleQueryKinds = bqrsInfo.compatibleQueryKinds;

  const outputPromises: Array<Promise<string[]>> = [
    outputCsv(codeql, bqrs),
    outputMd(
      codeql,
      bqrs,
      nwo,
      dbMetadata.creationMetadata?.sha || "HEAD",
      compatibleQueryKinds
    ),
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
      `https://api.github.com/repos/${repoName}/code-scanning/codeql/databases/${language}`,
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
  return deserialize(bqrsInfoOutput.stdout);
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
  const jsonResults = JSON.parse(await fs.promises.readFile(json, "utf8"));

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
    "--sarif-add-snippets",
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
  await fs.promises.writeFile(count, selectResultSet.rows.toString(), "utf8");
  return [count];
}

interface DatabaseMetadata {
  creationMetadata?: {
    sha?: string;
    cliVersion?: string;
  };
}

/**
 * Gets (a subset of) the database metadata from a CodeQL database. In the
 * future this information may be available using `codeql resolve database`
 * instead. Because this information is only used for enhancing the output we
 * catch errors for now. The caller must decide what to do in the case of
 * missing information.
 *
 * @param database The name of the database.
 * @returns The database metadata.
 */
function getDatabaseMetadata(database: string): DatabaseMetadata {
  try {
    return yaml.load(
      fs.readFileSync(path.join(database, "codeql-database.yml"), "utf8")
    ) as DatabaseMetadata;
  } catch (error) {
    console.log(`Unable to read codeql-database.yml: ${error}`);
    return {};
  }
}

/**
 * Gets the query for a pack, assuming there is a single query in that pack's default suite.
 *
 * @param codeql The path to the codeql CLI
 * @param queryPack The path to the query pack on disk.
 * @returns The path to a query file.
 */
async function getRemoteQueryPackDefaultQuery(
  codeql: string,
  queryPack: string
): Promise<string> {
  const output = await getExecOutput(codeql, [
    "resolve",
    "queries",
    "--format=json",
    "--additional-packs",
    queryPack,
    REMOTE_QUERY_PACK_NAME,
  ]);

  const queries = JSON.parse(output.stdout) as string[];
  if (
    !Array.isArray(queries) ||
    queries.length !== 1 ||
    typeof queries[0] !== "string"
  ) {
    throw new Error("Unexpected output from codeql resolve queries");
  }

  return queries[0];
}
