"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSarifResultCount = exports.injectVersionControlInfo = exports.getRemoteQueryPackDefaultQuery = exports.getDatabaseMetadata = exports.getBqrsInfo = exports.runQuery = exports.downloadDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec_1 = require("@actions/exec");
const yaml = __importStar(require("js-yaml"));
const deserialize_1 = require("./deserialize");
const download_1 = require("./download");
const query_run_memory_1 = require("./query-run-memory");
const query_run_metadata_1 = require("./query-run-metadata");
// This name must match that used by the vscode extension when creating the pack.
const REMOTE_QUERY_PACK_NAME = "codeql-remote/query";
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
async function runQuery(codeql, database, nwo, queryPack) {
    var _a, _b, _c, _d;
    fs_1.default.mkdirSync("results");
    const databaseName = "db";
    await (0, exec_1.exec)(codeql, [
        "database",
        "unbundle",
        database,
        `--name=${databaseName}`,
    ]);
    const dbMetadata = getDatabaseMetadata(databaseName);
    console.log(`This database was created using CodeQL CLI version ${(_a = dbMetadata.creationMetadata) === null || _a === void 0 ? void 0 : _a.cliVersion}`);
    await (0, exec_1.exec)(codeql, [
        "database",
        "run-queries",
        `--ram=${(0, query_run_memory_1.getMemoryFlagValue)().toString()}`,
        "--additional-packs",
        queryPack,
        "--",
        databaseName,
        REMOTE_QUERY_PACK_NAME,
    ]);
    const bqrsFilePath = path_1.default.join("results", "results.bqrs");
    const tempBqrsFilePath = getBqrsFile(databaseName);
    fs_1.default.renameSync(tempBqrsFilePath, bqrsFilePath);
    const bqrsInfo = await getBqrsInfo(codeql, bqrsFilePath);
    const compatibleQueryKinds = bqrsInfo.compatibleQueryKinds;
    const sourceLocationPrefix = await getSourceLocationPrefix(codeql);
    const isSarif = queryCanHaveSarifOutput(compatibleQueryKinds);
    let resultCount;
    let sarifFilePath;
    if (isSarif) {
        const sarif = await generateSarif(codeql, bqrsFilePath, nwo, compatibleQueryKinds, databaseName, sourceLocationPrefix, (_b = dbMetadata.creationMetadata) === null || _b === void 0 ? void 0 : _b.sha);
        resultCount = getSarifResultCount(sarif);
        sarifFilePath = path_1.default.join("results", "results.sarif");
        fs_1.default.writeFileSync(sarifFilePath, JSON.stringify(sarif));
    }
    else {
        resultCount = getBqrsResultCount(bqrsInfo);
    }
    const metadataFilePath = path_1.default.join("results", "metadata.json");
    (0, query_run_metadata_1.writeQueryRunMetadataToFile)(metadataFilePath, nwo, resultCount, (_c = dbMetadata.creationMetadata) === null || _c === void 0 ? void 0 : _c.sha, sourceLocationPrefix);
    return {
        resultCount,
        databaseSHA: (_d = dbMetadata.creationMetadata) === null || _d === void 0 ? void 0 : _d.sha,
        sourceLocationPrefix,
        metadataFilePath,
        bqrsFilePath,
        sarifFilePath,
    };
}
exports.runQuery = runQuery;
async function downloadDatabase(repoId, repoName, language, pat) {
    let authHeader = undefined;
    if (pat) {
        authHeader = `token ${pat}`;
    }
    try {
        return await (0, download_1.download)(`https://api.github.com/repos/${repoName}/code-scanning/codeql/databases/${language}`, `${repoId}.zip`, authHeader, "application/zip");
    }
    catch (error) {
        console.log("Error while downloading database");
        if (error.httpStatusCode === 404 &&
            error.httpMessage.includes("No database available for")) {
            throw new Error(`Language mismatch: The query targets ${language}, but the repository "${repoName}" has no CodeQL database available for that language.`);
        }
        else {
            throw error;
        }
    }
}
exports.downloadDatabase = downloadDatabase;
// Calls `bqrs info` for the given bqrs file and returns JSON output
async function getBqrsInfo(codeql, bqrs) {
    const bqrsInfoOutput = await (0, exec_1.getExecOutput)(codeql, [
        "bqrs",
        "info",
        "--format=json",
        bqrs,
    ]);
    if (bqrsInfoOutput.exitCode !== 0) {
        throw new Error(`Unable to run codeql bqrs info. Exit code: ${bqrsInfoOutput.exitCode}`);
    }
    return (0, deserialize_1.deserialize)(bqrsInfoOutput.stdout);
}
exports.getBqrsInfo = getBqrsInfo;
async function getSourceLocationPrefix(codeql) {
    const resolveDbOutput = await (0, exec_1.getExecOutput)(codeql, [
        "resolve",
        "database",
        "db",
    ]);
    return JSON.parse(resolveDbOutput.stdout).sourceLocationPrefix;
}
/**
 * Checks if the query kind is compatible with SARIF output.
 */
function queryCanHaveSarifOutput(compatibleQueryKinds) {
    return (compatibleQueryKinds.includes("Problem") ||
        compatibleQueryKinds.includes("PathProblem"));
}
// Generates sarif from the given bqrs file, if query kind supports it
async function generateSarif(codeql, bqrs, nwo, compatibleQueryKinds, databaseName, sourceLocationPrefix, databaseSHA) {
    let kind;
    if (compatibleQueryKinds.includes("Problem")) {
        kind = "problem";
    }
    else if (compatibleQueryKinds.includes("PathProblem")) {
        kind = "path-problem";
    }
    else {
        // Cannot generate sarif for this query kind
        return [];
    }
    const sarifFile = path_1.default.join("results", "results.sarif");
    await (0, exec_1.exec)(codeql, [
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
    const sarif = JSON.parse(fs_1.default.readFileSync(sarifFile, "utf8"));
    injectVersionControlInfo(sarif, nwo, databaseSHA);
    return sarif;
}
/**
 * Injects the GitHub repository URL and, if available, the commit SHA into the
 * SARIF `versionControlProvenance` property.
 */
function injectVersionControlInfo(sarif, nwo, databaseSHA) {
    if (Array.isArray(sarif.runs)) {
        for (const run of sarif.runs) {
            run.versionControlProvenance = run.versionControlProvenance || [];
            if (databaseSHA) {
                run.versionControlProvenance.push({
                    repositoryUri: `https://github.com/${nwo}`,
                    revisionId: databaseSHA,
                });
            }
            else {
                run.versionControlProvenance.push({
                    repositoryUri: `https://github.com/${nwo}`,
                });
            }
        }
    }
}
exports.injectVersionControlInfo = injectVersionControlInfo;
/**
 * Gets the number of results in the given SARIF data.
 */
function getSarifResultCount(sarif) {
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
exports.getSarifResultCount = getSarifResultCount;
/**
 * Gets the number of results in the given BQRS data.
 */
function getBqrsResultCount(bqrsInfo) {
    const selectResultSet = bqrsInfo.resultSets.find((resultSet) => resultSet.name === "#select");
    if (!selectResultSet) {
        throw new Error("No result set named #select");
    }
    return selectResultSet.rows;
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
function getDatabaseMetadata(database) {
    try {
        return yaml.load(fs_1.default.readFileSync(path_1.default.join(database, "codeql-database.yml"), "utf8"));
    }
    catch (error) {
        console.log(`Unable to read codeql-database.yml: ${error}`);
        return {};
    }
}
exports.getDatabaseMetadata = getDatabaseMetadata;
/**
 * Gets the query for a pack, assuming there is a single query in that pack's default suite.
 *
 * @param codeql The path to the codeql CLI
 * @param queryPack The path to the query pack on disk.
 * @returns The path to a query file.
 */
async function getRemoteQueryPackDefaultQuery(codeql, queryPack) {
    const output = await (0, exec_1.getExecOutput)(codeql, [
        "resolve",
        "queries",
        "--format=json",
        "--additional-packs",
        queryPack,
        REMOTE_QUERY_PACK_NAME,
    ]);
    const queries = JSON.parse(output.stdout);
    if (!Array.isArray(queries) ||
        queries.length !== 1 ||
        typeof queries[0] !== "string") {
        throw new Error("Unexpected output from codeql resolve queries");
    }
    return queries[0];
}
exports.getRemoteQueryPackDefaultQuery = getRemoteQueryPackDefaultQuery;
/**
 * Finds the BQRS result file for a database and ensures that exactly one is produced.
 * Returns the path to that BQRS file.
 * @param databaseName The name of the database that was analyzed.
 * @returns string     The path to the BQRS result file.
 */
function getBqrsFile(databaseName) {
    // This is where results are saved, according to
    // https://codeql.github.com/docs/codeql-cli/manual/database-run-queries/
    let dbResultsFolder = `${databaseName}/results`;
    let entries;
    while ((entries = fs_1.default.readdirSync(dbResultsFolder, { withFileTypes: true })) &&
        entries.length === 1 &&
        entries[0].isDirectory()) {
        dbResultsFolder = path_1.default.join(dbResultsFolder, entries[0].name);
    }
    if (entries.length !== 1) {
        throw new Error(`Expected a single file in ${dbResultsFolder}, found: ${entries}`);
    }
    const entry = entries[0];
    if (!entry.isFile() || !entry.name.endsWith(".bqrs")) {
        throw new Error(`Unexpected file in ${dbResultsFolder}: ${entry.name}`);
    }
    return path_1.default.join(dbResultsFolder, entry.name);
}
//# sourceMappingURL=codeql.js.map