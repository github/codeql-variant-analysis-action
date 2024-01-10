import fs from "fs";
import path from "path";

import { exec, getExecOutput } from "@actions/exec";

import { camelize } from "./deserialize";
import { download } from "./download";
import { HTTPError } from "./http-error";
import { validateObject } from "./json-validation";
import { getMemoryFlagValue } from "./query-run-memory";
import { parseYamlFromFile } from "./yaml";

export interface RunQueryResult {
  resultCount: number;
  databaseSHA: string | undefined;
  databaseName: string;
  sourceLocationPrefix: string;
  bqrsFilePaths: BqrsFilePaths;
  sarifFilePath?: string;
}

interface BqrsFilePaths {
  basePath: string;
  relativeFilePaths: string[];
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
 * - results/  (results.{bqrs,sarif})
 *
 * @param     codeql                    The path to the codeql binary
 * @param     database                  The path to the bundled database zip file
 * @param     nwo                       The name of the repository
 * @param     queryPack                 The path to the query pack
 * @returns   Promise<RunQueryResult>   Resolves when the query has finished running. Returns information
 * about the query result and paths to the result files.
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

  const queryPaths = await getQueryPackQueries(codeql, queryPack);

  // Calculate query run information like BQRS file paths, etc.
  const queryPackRunResults = await getQueryPackRunResults(
    codeql,
    databaseName,
    queryPaths,
    queryPack,
    queryPackName,
  );

  const sourceLocationPrefix = await getSourceLocationPrefix(codeql);

  const shouldGenerateSarif = await queryPackSupportsSarif(
    codeql,
    queryPackRunResults,
  );

  let resultCount: number;
  let sarifFilePath: string | undefined;
  if (shouldGenerateSarif) {
    const sarif = await generateSarif(
      codeql,
      nwo,
      databaseName,
      queryPackName,
      databaseSHA,
    );
    resultCount = getSarifResultCount(sarif);
    sarifFilePath = path.join("results", "results.sarif");
    fs.writeFileSync(sarifFilePath, JSON.stringify(sarif));
  } else {
    resultCount = queryPackRunResults.totalResultsCount;
  }

  const bqrsFilePaths = await adjustBqrsFiles(queryPackRunResults);

  return {
    resultCount,
    databaseSHA,
    databaseName,
    sourceLocationPrefix,
    bqrsFilePaths,
    sarifFilePath,
  };
}

async function adjustBqrsFiles(
  queryPackRunResults: QueryPackRunResults,
): Promise<BqrsFilePaths> {
  if (queryPackRunResults.queries.length === 1) {
    // If we have a single query, move the BQRS file to "results.bqrs" in order to
    // maintain backwards compatibility with the VS Code extension, since it expects
    // the BQRS file to be at the top level and be called "results.bqrs".
    const currentBqrsFilePath = path.join(
      queryPackRunResults.resultsBasePath,
      queryPackRunResults.queries[0].relativeBqrsFilePath,
    );
    const newBqrsFilePath = path.join("results", "results.bqrs");
    await fs.promises.rename(currentBqrsFilePath, newBqrsFilePath);
    return { basePath: "results", relativeFilePaths: [newBqrsFilePath] };
  }

  return {
    basePath: queryPackRunResults.resultsBasePath,
    relativeFilePaths: queryPackRunResults.queries.map(
      (q) => q.relativeBqrsFilePath,
    ),
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

// Calls `resolve metadata` for the given query file and returns JSON output
async function getQueryMetadata(
  codeql: string,
  query: string,
): Promise<QueryMetadata> {
  const queryMetadataOutput = await getExecOutput(codeql, [
    "resolve",
    "metadata",
    "--format=json",
    query,
  ]);
  if (queryMetadataOutput.exitCode !== 0) {
    throw new Error(
      `Unable to run codeql resolve metadata. Exit code: ${queryMetadataOutput.exitCode}`,
    );
  }
  return validateObject(
    JSON.parse(queryMetadataOutput.stdout, camelize),
    "queryMetadata",
  );
}

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

interface QueryPackRunResults {
  queries: Array<{
    queryPath: string;
    relativeBqrsFilePath: string;
    bqrsInfo: BQRSInfo;
  }>;
  totalResultsCount: number;
  resultsBasePath: string;
}

async function getQueryPackRunResults(
  codeql: string,
  databaseName: string,
  queryPaths: string[],
  queryPackPath: string,
  queryPackName: string,
): Promise<QueryPackRunResults> {
  // This is where results are saved, according to
  // https://codeql.github.com/docs/codeql-cli/manual/database-run-queries/
  const resultsBasePath = `${databaseName}/results`;

  const queries: Array<{
    queryPath: string;
    relativeBqrsFilePath: string;
    bqrsInfo: BQRSInfo;
  }> = [];

  let totalResultsCount = 0;

  for (const queryPath of queryPaths) {
    // Calculate the BQRS file path
    const queryPackRelativePath = path.relative(queryPackPath, queryPath);
    const parsedQueryPath = path.parse(queryPackRelativePath);
    const relativeBqrsFilePath = path.join(
      queryPackName,
      parsedQueryPath.dir,
      `${parsedQueryPath.name}.bqrs`,
    );
    const bqrsFilePath = path.join(resultsBasePath, relativeBqrsFilePath);

    if (!fs.existsSync(bqrsFilePath)) {
      throw new Error(
        `Could not find BQRS file for query ${queryPath} at ${bqrsFilePath}`,
      );
    }

    const bqrsInfo = await getBqrsInfo(codeql, bqrsFilePath);

    queries.push({
      queryPath,
      relativeBqrsFilePath,
      bqrsInfo,
    });

    totalResultsCount += getBqrsResultCount(bqrsInfo);
  }

  return {
    totalResultsCount,
    resultsBasePath,
    queries,
  };
}

async function querySupportsSarif(
  codeql: string,
  queryPath: string,
  bqrsInfo: BQRSInfo,
): Promise<boolean> {
  const compatibleQueryKinds = bqrsInfo.compatibleQueryKinds;

  const queryMetadata = await getQueryMetadata(codeql, queryPath);

  const sarifOutputType = getSarifOutputType(
    queryMetadata,
    compatibleQueryKinds,
  );

  return sarifOutputType !== undefined;
}

async function queryPackSupportsSarif(
  codeql: string,
  queriesResultInfo: QueryPackRunResults,
) {
  // Some queries in the pack must support SARIF in order
  // for the query pack to support SARIF.
  return (
    await Promise.all(
      queriesResultInfo.queries.map((q) =>
        querySupportsSarif(codeql, q.queryPath, q.bqrsInfo),
      ),
    )
  ).some((result) => result);
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

/**
 * Gets the number of results in the given BQRS data.
 */
function getBqrsResultCount(bqrsInfo: BQRSInfo): number {
  const selectResultSet = bqrsInfo.resultSets.find(
    (resultSet) => resultSet.name === "#select",
  );
  if (!selectResultSet) {
    throw new Error("No result set named #select");
  }
  return selectResultSet.rows;
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

// The expected output from "codeql resolve queries" in getQueryPackQueries
export type ResolvedQueries = string[];

/**
 * Gets the queries for a pack.
 *
 * @param codeql The path to the codeql CLI
 * @param queryPack The path to the query pack on disk.
 * @returns The path to a query file.
 */
export async function getQueryPackQueries(
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
