import fs from "fs";
import path from "path";

import { exec, getExecOutput } from "@actions/exec";

import { camelize } from "./deserialize";
import { download } from "./download";
import { HTTPError } from "./http-error";
import { validateObject } from "./json-validation";
import { getMemoryFlagValue } from "./query-run-memory";
import { writeQueryRunMetadataToFile } from "./query-run-metadata";
import { parseYamlFromFile } from "./yaml";

export interface RunQueryResult {
  resultCount: number;
  databaseName: string;
  databaseSHA: string | undefined;
  sourceLocationPrefix: string;
  metadataFilePath: string;
  bqrsFilePaths: string[];
  totalBqrsFileSize: number;
  sarifFilePath?: string;
  sarifFileSize?: number;
}

// Must be a valid value for "-t=kind" when doing "codeql bqrs interpret"
type SarifOutputType = "problem" | "path-problem";

// Models just the pieces of the SARIF spec that we need
export interface Sarif {
  runs: Array<{
    versionControlProvenance?: unknown[];
    results: unknown[];
  }>;
}

/**
 * Run a query. Will operate on the current working directory and create the following directories:
 * - query/    (query.ql and any other supporting files)
 * - results/  (results.{bqrs,sarif} and metadata.json)
 *
 * @param     codeql                    The path to the codeql binary
 * @param     database                  The path to the bundled database zip file
 * @param     nwo                       The name of the repository
 * @param     queryPack                 The path to the query pack
 * @returns   Promise<RunQueryResult>   Resolves when the query has finished running. Returns information
 * about the query result and paths to the result files and metadata.json file.
 */
export async function runQuery(
  codeql: string,
  database: string,
  nwo: string,
  queryPack: string,
): Promise<RunQueryResult> {
  fs.mkdirSync("results");

  const databaseName = "db";
  await exec(codeql, [
    "database",
    "unbundle",
    database,
    `--name=${databaseName}`,
  ]);

  const dbMetadata = getDatabaseMetadata(databaseName);
  console.log(
    `This database was created using CodeQL CLI version ${dbMetadata.creationMetadata?.cliVersion}`,
  );
  const databaseSHA = dbMetadata.creationMetadata?.sha?.toString();

  const queryPackName = getQueryPackName(queryPack);

  await exec(codeql, [
    "database",
    "run-queries",
    `--ram=${getMemoryFlagValue().toString()}`,
    "--additional-packs",
    queryPack,
    "--",
    databaseName,
    queryPackName,
  ]);

  const bqrsFilePaths = getBqrsFiles(databaseName);

  const totalBqrsFileSize = bqrsFilePaths.reduce(
    (v, p) => v + fs.statSync(p).size,
    0,
  );

  const sourceLocationPrefix = await getSourceLocationPrefix(codeql);

  const sarif = await generateSarif(
    codeql,
    nwo,
    databaseName,
    queryPackName,
    databaseSHA,
  );
  const resultCount = getSarifResultCount(sarif);
  const sarifFilePath = path.join("results", "results.sarif");
  fs.writeFileSync(sarifFilePath, JSON.stringify(sarif));
  const sarifFileSize = fs.statSync(sarifFilePath).size;
  const metadataFilePath = path.join("results", "metadata.json");

  writeQueryRunMetadataToFile(
    metadataFilePath,
    nwo,
    resultCount,
    databaseSHA,
    sourceLocationPrefix,
  );

  return {
    resultCount,
    databaseName,
    databaseSHA,
    sourceLocationPrefix,
    metadataFilePath,
    bqrsFilePaths,
    totalBqrsFileSize,
    sarifFilePath,
    sarifFileSize,
  };
}

export async function downloadDatabase(
  repoId: number,
  repoName: string,
  language: string,
  pat?: string,
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
      "application/zip",
    );
  } catch (error: unknown) {
    console.log("Error while downloading database");
    if (
      error instanceof HTTPError &&
      error.httpStatusCode === 404 &&
      error.httpMessage.includes("No database available for")
    ) {
      throw new Error(
        `Language mismatch: The query targets ${language}, but the repository "${repoName}" has no CodeQL database available for that language.`,
      );
    } else {
      throw error;
    }
  }
}

export type QueryMetadata = {
  id?: string;
  kind?: string;
};

export interface BQRSInfo {
  resultSets: Array<{
    name: string;
    rows: number;
  }>;
  compatibleQueryKinds: string[];
}

// Calls `bqrs info` for the given bqrs file and returns JSON output
export async function getBqrsInfo(
  codeql: string,
  bqrs: string,
): Promise<BQRSInfo> {
  const bqrsInfoOutput = await getExecOutput(codeql, [
    "bqrs",
    "info",
    "--format=json",
    bqrs,
  ]);
  if (bqrsInfoOutput.exitCode !== 0) {
    throw new Error(
      `Unable to run codeql bqrs info. Exit code: ${bqrsInfoOutput.exitCode}`,
    );
  }
  return validateObject(
    JSON.parse(bqrsInfoOutput.stdout, camelize),
    "bqrsInfo",
  );
}

// The expected output from "codeql resolve database" in getSourceLocationPrefix
export interface ResolvedDatabase {
  sourceLocationPrefix: string;
}

async function getSourceLocationPrefix(codeql: string) {
  const resolveDbOutput = await getExecOutput(codeql, [
    "resolve",
    "database",
    "db",
  ]);
  const resolvedDatabase = validateObject(
    JSON.parse(resolveDbOutput.stdout),
    "resolvedDatabase",
  );
  return resolvedDatabase.sourceLocationPrefix;
}

/**
 * Checks if the query kind is compatible with SARIF output.
 */
export function getSarifOutputType(
  queryMetadata: QueryMetadata,
  compatibleQueryKinds: string[],
): SarifOutputType | undefined {
  const queryKind = queryMetadata.kind;
  if (
    queryKind === "path-problem" &&
    compatibleQueryKinds.includes("PathProblem")
  ) {
    return "path-problem";
  } else if (
    queryKind === "problem" &&
    compatibleQueryKinds.includes("Problem")
  ) {
    return "problem";
  } else {
    return undefined;
  }
}

// Generates sarif from the given bqrs file, if query kind supports it
async function generateSarif(
  codeql: string,
  nwo: string,
  databaseName: string,
  queryPackName: string,
  databaseSHA?: string,
): Promise<Sarif> {
  const sarifFile = path.join("results", "results.sarif");
  await exec(codeql, [
    "database",
    "interpret-results",
    "--format=sarif-latest",
    `--output=${sarifFile}`,
    "--sarif-add-snippets",
    "--no-group-results",
    databaseName,
    queryPackName,
  ]);
  const sarif = validateObject(
    JSON.parse(fs.readFileSync(sarifFile, "utf8")),
    "sarif",
  );

  injectVersionControlInfo(sarif, nwo, databaseSHA);
  return sarif;
}

/**
 * Injects the GitHub repository URL and, if available, the commit SHA into the
 * SARIF `versionControlProvenance` property.
 */
export function injectVersionControlInfo(
  sarif: Sarif,
  nwo: string,
  databaseSHA?: string,
): void {
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

/**
 * Gets the number of results in the given SARIF data.
 */
export function getSarifResultCount(sarif: Sarif): number {
  let count = 0;
  for (const run of sarif.runs) {
    count = count + run.results.length;
  }
  return count;
}

interface DatabaseMetadata {
  creationMetadata?: {
    sha?: string | bigint;
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
export function getDatabaseMetadata(database: string): DatabaseMetadata {
  try {
    return parseYamlFromFile<DatabaseMetadata>(
      path.join(database, "codeql-database.yml"),
    );
  } catch (error) {
    console.log(`Unable to read codeql-database.yml: ${error}`);
    return {};
  }
}

function findFilesInDir(startPath: string, filter: (path: string) => boolean) {
  const results: string[] = [];
  for (const relativePath of fs.readdirSync(startPath)) {
    const filename = path.join(startPath, relativePath);
    const stat = fs.lstatSync(filename);
    if (stat.isDirectory()) {
      results.push(...findFilesInDir(filename, filter));
    } else if (filter(filename)) {
      results.push(filename);
    }
  }
  return results;
}

// The expected output from "codeql resolve queries" in getRemoteQueryPackDefaultQuery
export type ResolvedQueries = string[];

/**
 * Gets the query for a pack, assuming there is a single query in that pack's default suite.
 *
 * @param codeql The path to the codeql CLI
 * @param queryPack The path to the query pack on disk.
 * @returns The path to a query file.
 */
export async function getRemoteQueryPackQueries(
  codeql: string,
  queryPack: string,
): Promise<string[]> {
  const output = await getExecOutput(codeql, [
    "resolve",
    "queries",
    "--format=json",
    "--additional-packs",
    queryPack,
    getQueryPackName(queryPack),
  ]);

  return validateObject(JSON.parse(output.stdout), "resolvedQueries");
}

/**
 * Finds the BQRS result files for a database and returns the paths to those BQRS files.
 *
 * @param databaseName The name of the database that was analyzed.
 * @returns string[]   The paths to the BQRS result files.
 */
function getBqrsFiles(databaseName: string): string[] {
  // This is where results are saved, according to
  // https://codeql.github.com/docs/codeql-cli/manual/database-run-queries/
  const dbResultsFolder = `${databaseName}/results`;

  const bqrsFiles = findFilesInDir(dbResultsFolder, (p) => p.endsWith(".bqrs"));
  if (bqrsFiles.length === 0) {
    throw new Error(`Found zero BQRS files in ${dbResultsFolder}`);
  }
  return bqrsFiles;
}

function getQueryPackName(queryPackPath: string) {
  const qlpackFile = path.join(queryPackPath, "qlpack.yml");
  const codeqlpackFile = path.join(queryPackPath, "codeql-pack.yml");
  let packFile: string;
  if (
    fs
      .statSync(qlpackFile, {
        throwIfNoEntry: false,
      })
      ?.isFile()
  ) {
    packFile = qlpackFile;
  } else if (
    fs
      .statSync(codeqlpackFile, {
        throwIfNoEntry: false,
      })
      ?.isFile()
  ) {
    packFile = codeqlpackFile;
  } else {
    throw new Error(`Path '${queryPackPath}' is missing a qlpack file.`);
  }
  const packContents = parseYamlFromFile<{ name: string }>(packFile);
  return packContents.name;
}
