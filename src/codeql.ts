import fs from "fs";
import path from "path";

import { exec, getExecOutput } from "@actions/exec";
import * as yaml from "js-yaml";

import { deserialize } from "./deserialize";
import { download } from "./download";

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
  const outputFiles = [bqrs, nwoFile];

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
  let databaseSHAFile: string | undefined;
  if (dbMetadata.creationMetadata?.sha) {
    databaseSHAFile = path.join("results", "sha.txt");
    fs.writeFileSync(databaseSHAFile, dbMetadata.creationMetadata.sha);
    outputFiles.push(databaseSHAFile);
  }

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

  const sourceLocationPrefix = await getSourceLocationPrefix(codeql);
  const isSarif = queryCanHaveSarifOutput(compatibleQueryKinds);
  const outputPromises: Array<Promise<string[]>> = [
    isSarif
      ? outputSarifAndCount(
          codeql,
          bqrs,
          nwo,
          compatibleQueryKinds,
          databaseName,
          sourceLocationPrefix,
          dbMetadata.creationMetadata?.sha
        )
      : outputBqrsResultCount(bqrsInfo),
  ];

  return outputFiles.concat(...(await Promise.all(outputPromises)));
}

async function downloadDatabase(
  repoId: number,
  repoName: string,
  language: string,
  pat?: string
): Promise<string> {
  let authHeader: string | undefined = undefined;
  if (pat) {
    authHeader = `token ${pat}`;
  }

  try {
    return await download(
      `https://api.github.com/repos/${repoName}/code-scanning/codeql/databases/${language}`,
      `${repoId}.zip`,
      authHeader,
      "application/zip"
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

async function getSourceLocationPrefix(codeql: string) {
  const resolveDbOutput = await getExecOutput(codeql, [
    "resolve",
    "database",
    "db",
  ]);
  return JSON.parse(resolveDbOutput.stdout).sourceLocationPrefix;
}

/**
 * Checks if the query kind is compatible with SARIF output.
 */
function queryCanHaveSarifOutput(compatibleQueryKinds: string[]): boolean {
  return (
    compatibleQueryKinds.includes("Problem") ||
    compatibleQueryKinds.includes("PathProblem")
  );
}

// Generates results.sarif from the given bqrs file, if query kind supports it
async function outputSarifAndCount(
  codeql: string,
  bqrs: string,
  nwo: string,
  compatibleQueryKinds: string[],
  databaseName: string,
  sourceLocationPrefix: string,
  databaseSHA?: string
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

  const sarifFile = path.join("results", "results.sarif");
  await exec(codeql, [
    "bqrs",
    "interpret",
    "--format=sarif-latest",
    `--output=${sarifFile}`,
    `-t=kind=${kind}`,
    "-t=id=remote-query",
    "--sarif-add-snippets",
    "--no-group-results",
    // Hard-coded the source archive as src.zip inside the database, since that's
    // where the CLI puts it. If this changes, we need to update this path.
    `--source-archive=${databaseName}/src.zip`,
    `--source-location-prefix=${sourceLocationPrefix}`,
    bqrs,
  ]);
  const sarif = JSON.parse(fs.readFileSync(sarifFile, "utf8"));

  injectVersionControlInfo(sarif, nwo, databaseSHA);
  fs.writeFileSync(sarifFile, JSON.stringify(sarif));

  const resultCountFile = path.join("results", "resultcount.txt");

  const sarifResultCount = getSarifResultCount(sarif);
  fs.writeFileSync(resultCountFile, JSON.stringify(sarifResultCount));

  return [sarifFile, resultCountFile];
}

/**
 * Injects the GitHub repository URL and, if available, the commit SHA into the
 * SARIF `versionControlProvenance` property.
 */
export function injectVersionControlInfo(
  sarif: any,
  nwo: string,
  databaseSHA?: string
) {
  if (Array.isArray(sarif.runs)) {
    for (const run of sarif.runs) {
      run.versionControlProvenance = run.versionControlProvenance || [];
      if (databaseSHA) {
        run.versionControlProvenance.push({
          repositoryUri: `https://github.com/${nwo}`,
          revisionId: databaseSHA,
        });
      } else {
        run.versionControlProvenance.push({
          repositoryUri: `https://github.com/${nwo}`,
        });
      }
    }
  }
}

/**
 * Gets the number of results in the given SARIF data.
 */
export function getSarifResultCount(sarif: any): number {
  let count = 0;
  if (Array.isArray(sarif.runs)) {
    for (const run of sarif.runs) {
      if (Array.isArray(run.results)) {
        count = count + parseInt(run.results.length);
      }
    }
  }
  return count;
}

/**
 * Gets the number of results in the given BQRS data.
 */
async function outputBqrsResultCount(bqrsInfo: BQRSInfo): Promise<string[]> {
  const resultCountFile = path.join("results", "resultcount.txt");
  // find the rows for the result set with name "#select"
  const selectResultSet = bqrsInfo.resultSets.find(
    (resultSet) => resultSet.name === "#select"
  );
  if (!selectResultSet) {
    throw new Error("No result set named #select");
  }
  await fs.promises.writeFile(
    resultCountFile,
    selectResultSet.rows.toString(),
    "utf8"
  );
  return [resultCountFile];
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
