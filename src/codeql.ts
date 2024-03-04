import fs from "fs";
import path from "path";

import { CodeqlCli } from "./codeql-cli";
import { camelize } from "./deserialize";
import { download } from "./download";
import { HTTPError } from "./http-error";
import { validateObject } from "./json-validation";
import { getMemoryFlagValue } from "./query-run-memory";
import { parseYamlFromFile } from "./yaml";

export interface RunQueryResult {
  resultCount: number;
  databaseSHA: string | undefined;
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
 * @param     codeql                    A runner of the CodeQL CLI to execute commands
 * @param     database                  The path to the bundled database zip file
 * @param     nwo                       The name of the repository
 * @param     queryPackPath             The path to the query pack
 * @returns   Promise<RunQueryResult>   Resolves when the query has finished running. Returns information
 * about the query result and paths to the result files.
 */
export async function runQuery(
  codeql: CodeqlCli,
  database: string,
  nwo: string,
  queryPack: QueryPackInfo,
): Promise<RunQueryResult> {
  fs.mkdirSync("results");

  const databasePath = path.resolve("db");
  await codeql.run([
    "database",
    "unbundle",
    database,
    `--name=${path.basename(databasePath)}`,
    `--target=${path.dirname(databasePath)}`,
  ]);

  const dbMetadata = getDatabaseMetadata(databasePath);
  console.log(
    `This database was created using CodeQL CLI version ${dbMetadata.creationMetadata?.cliVersion}`,
  );
  const databaseSHA = dbMetadata.creationMetadata?.sha?.toString();

  await codeql.run([
    "database",
    "run-queries",
    `--ram=${getMemoryFlagValue().toString()}`,
    "--additional-packs",
    queryPack.path,
    "--",
    databasePath,
    queryPack.name,
  ]);

  // Calculate query run information like BQRS file paths, etc.
  const queryPackRunResults = await getQueryPackRunResults(
    codeql,
    databasePath,
    queryPack,
  );

  const sourceLocationPrefix = await getSourceLocationPrefix(
    codeql,
    databasePath,
  );

  const shouldGenerateSarif = queryPackSupportsSarif(queryPackRunResults);

  let resultCount: number;
  let sarifFilePath: string | undefined;
  if (shouldGenerateSarif) {
    const sarif = await generateSarif(
      codeql,
      nwo,
      databasePath,
      queryPack.path,
      databaseSHA,
    );
    resultCount = getSarifResultCount(sarif);
    sarifFilePath = path.resolve("results", "results.sarif");
    fs.writeFileSync(sarifFilePath, JSON.stringify(sarif));
  } else {
    resultCount = queryPackRunResults.totalResultsCount;
  }

  const bqrsFilePaths = await adjustBqrsFiles(queryPackRunResults);

  return {
    resultCount,
    databaseSHA,
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
    const newBqrsFilePath = path.resolve("results", "results.bqrs");
    await fs.promises.rename(currentBqrsFilePath, newBqrsFilePath);
    return { basePath: "results", relativeFilePaths: ["results.bqrs"] };
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
  codeql: CodeqlCli,
  query: string,
): Promise<QueryMetadata> {
  const queryMetadataOutput = await codeql.run([
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
  codeql: CodeqlCli,
  bqrs: string,
): Promise<BQRSInfo> {
  const bqrsInfoOutput = await codeql.run([
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

async function getSourceLocationPrefix(
  codeql: CodeqlCli,
  databasePath: string,
) {
  const resolveDbOutput = await codeql.run([
    "resolve",
    "database",
    databasePath,
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
    queryMetadata: QueryMetadata;
    relativeBqrsFilePath: string;
    bqrsInfo: BQRSInfo;
  }>;
  totalResultsCount: number;
  resultsBasePath: string;
}

async function getQueryPackRunResults(
  codeql: CodeqlCli,
  databasePath: string,
  queryPack: QueryPackInfo,
): Promise<QueryPackRunResults> {
  // This is where results are saved, according to
  // https://codeql.github.com/docs/codeql-cli/manual/database-run-queries/
  const resultsBasePath = path.resolve(databasePath, "results");

  const queries: Array<{
    queryPath: string;
    queryMetadata: QueryMetadata;
    relativeBqrsFilePath: string;
    bqrsInfo: BQRSInfo;
  }> = [];

  let totalResultsCount = 0;

  for (const [queryPath, queryMetadata] of Object.entries(queryPack.queries)) {
    // Calculate the BQRS file path
    const queryPackRelativePath = path.relative(queryPack.path, queryPath);
    const parsedQueryPath = path.parse(queryPackRelativePath);
    const relativeBqrsFilePath = path.join(
      queryPack.name,
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
      queryMetadata,
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

function querySupportsSarif(
  queryMetadata: QueryMetadata,
  bqrsInfo: BQRSInfo,
): boolean {
  const sarifOutputType = getSarifOutputType(
    queryMetadata,
    bqrsInfo.compatibleQueryKinds,
  );
  return sarifOutputType !== undefined;
}

/**
 * All queries in the pack must support SARIF in order
 * for the query pack to support SARIF.
 */
function queryPackSupportsSarif(
  queriesResultInfo: QueryPackRunResults,
): boolean {
  return queriesResultInfo.queries.every((q) =>
    querySupportsSarif(q.queryMetadata, q.bqrsInfo),
  );
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
    // path-alert is an alias of path-problem
    (queryKind === "path-problem" || queryKind === "path-alert") &&
    compatibleQueryKinds.includes("PathProblem")
  ) {
    return "path-problem";
  } else if (
    // alert is an alias of problem
    (queryKind === "problem" || queryKind === "alert") &&
    compatibleQueryKinds.includes("Problem")
  ) {
    return "problem";
  } else {
    return undefined;
  }
}

// Generates sarif from the given bqrs file, if query kind supports it
async function generateSarif(
  codeql: CodeqlCli,
  nwo: string,
  databasePath: string,
  queryPackPath: string,
  databaseSHA?: string,
): Promise<Sarif> {
  const sarifFile = path.resolve("results", "results.sarif");
  await codeql.run([
    "database",
    "interpret-results",
    "--format=sarif-latest",
    `--output=${sarifFile}`,
    "--sarif-add-snippets",
    "--no-group-results",
    databasePath,
    queryPackPath,
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
 * Names of result sets that can be considered the "default" result set
 * and should be used when calculating number of results and when showing
 * results to users.
 * Will check result sets in this order and use the first one that exists.
 */
const KNOWN_RESULT_SET_NAMES: string[] = ["#select", "problems"];

/**
 * Gets the number of results in the given BQRS data.
 */
export function getBqrsResultCount(bqrsInfo: BQRSInfo): number {
  for (const name of KNOWN_RESULT_SET_NAMES) {
    const resultSet = bqrsInfo.resultSets.find((r) => r.name === name);
    if (resultSet !== undefined) {
      return resultSet.rows;
    }
  }

  const resultSetNames = bqrsInfo.resultSets.map((r) => r.name);
  throw new Error(
    `BQRS does not contain any result sets matching known names. Expected one of ${KNOWN_RESULT_SET_NAMES.join(" or ")} but found ${resultSetNames.join(", ")}`,
  );
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
 * @param databasePath The path to the database.
 * @returns The database metadata.
 */
export function getDatabaseMetadata(databasePath: string): DatabaseMetadata {
  try {
    return parseYamlFromFile<DatabaseMetadata>(
      path.join(databasePath, "codeql-database.yml"),
    );
  } catch (error) {
    console.log(`Unable to read codeql-database.yml: ${error}`);
    return {};
  }
}

interface QueryPackInfo {
  path: string;
  name: string;
  queries: { [path: string]: QueryMetadata };
}

export async function getQueryPackInfo(
  codeql: CodeqlCli,
  queryPackPath: string,
): Promise<QueryPackInfo> {
  queryPackPath = path.resolve(queryPackPath);

  const name = getQueryPackName(queryPackPath);

  const queryPaths = await getQueryPackQueries(codeql, queryPackPath, name);
  const queries: { [path: string]: QueryMetadata } = {};
  for (const queryPath of queryPaths) {
    const queryMetadata = await getQueryMetadata(codeql, queryPath);
    queries[queryPath] = queryMetadata;
  }

  return {
    path: queryPackPath,
    name,
    queries,
  };
}

// The expected output from "codeql resolve queries" in getQueryPackQueries
export type ResolvedQueries = string[];

/**
 * Gets the queries for a pack.
 *
 * @param codeql The path to the codeql CLI
 * @param queryPackPath The path to the query pack on disk.
 * @returns The path to a query file.
 */
export async function getQueryPackQueries(
  codeql: CodeqlCli,
  queryPackPath: string,
  queryPackName: string,
): Promise<string[]> {
  const output = await codeql.run([
    "resolve",
    "queries",
    "--format=json",
    "--additional-packs",
    queryPackPath,
    queryPackName,
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
