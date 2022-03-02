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
exports.getRemoteQueryPackDefaultQuery = exports.getDatabaseMetadata = exports.getBqrsInfo = exports.runQuery = exports.downloadDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec_1 = require("@actions/exec");
const yaml = __importStar(require("js-yaml"));
const deserialize_1 = require("./deserialize");
const download_1 = require("./download");
const interpret_1 = require("./interpret");
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
async function runQuery(codeql, database, nwo, queryPack) {
    var _a, _b;
    const bqrs = path_1.default.join("results", "results.bqrs");
    fs_1.default.mkdirSync("results");
    const nwoFile = path_1.default.join("results", "nwo.txt");
    fs_1.default.writeFileSync(nwoFile, nwo);
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
        "--additional-packs",
        queryPack,
        "--",
        databaseName,
        REMOTE_QUERY_PACK_NAME,
    ]);
    let cur = `${databaseName}/results`;
    let entries;
    while ((entries = fs_1.default.readdirSync(cur, { withFileTypes: true })) &&
        entries.length === 1 &&
        entries[0].isDirectory()) {
        cur = path_1.default.join(cur, entries[0].name);
    }
    if (entries.length !== 1) {
        throw new Error(`Expected a single file in ${cur}, found: ${entries}`);
    }
    const entry = entries[0];
    if (!entry.isFile() || !entry.name.endsWith(".bqrs")) {
        throw new Error(`Unexpected file in ${cur}: ${entry.name}`);
    }
    fs_1.default.renameSync(path_1.default.join(cur, entry.name), bqrs);
    const bqrsInfo = await getBqrsInfo(codeql, bqrs);
    const compatibleQueryKinds = bqrsInfo.compatibleQueryKinds;
    const sourceLocationPrefix = await getSourceLocationPrefix(codeql);
    const outputPromises = [
        outputCsv(codeql, bqrs),
        outputMd(codeql, bqrs, nwo, ((_b = dbMetadata.creationMetadata) === null || _b === void 0 ? void 0 : _b.sha) || "HEAD", compatibleQueryKinds, sourceLocationPrefix),
        outputSarif(codeql, bqrs, compatibleQueryKinds, databaseName, sourceLocationPrefix),
        outputResultCount(bqrsInfo),
    ];
    return [bqrs, nwoFile].concat(...(await Promise.all(outputPromises)));
}
exports.runQuery = runQuery;
async function downloadDatabase(repoId, repoName, language, signedAuthToken, pat) {
    let authHeader = undefined;
    if (signedAuthToken) {
        authHeader = `RemoteAuth ${signedAuthToken}`;
    }
    else if (pat) {
        authHeader = `token ${pat}`;
    }
    try {
        return await (0, download_1.download)(`https://api.github.com/repos/${repoName}/code-scanning/codeql/databases/${language}`, `${repoId}.zip`, authHeader);
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
// Generates results.csv from the given bqrs file
async function outputCsv(codeql, bqrs) {
    const csv = path_1.default.join("results", "results.csv");
    await (0, exec_1.exec)(codeql, [
        "bqrs",
        "decode",
        "--format=csv",
        `--output=${csv}`,
        bqrs,
    ]);
    return [csv];
}
async function getSourceLocationPrefix(codeql) {
    const resolveDbOutput = await (0, exec_1.getExecOutput)(codeql, [
        "resolve",
        "database",
        "db",
    ]);
    return JSON.parse(resolveDbOutput.stdout).sourceLocationPrefix;
}
// Generates results.md from the given bqrs file
async function outputMd(codeql, bqrs, nwo, databaseSHA, compatibleQueryKinds, sourceLocationPrefix) {
    const json = path_1.default.join("results", "results.json");
    await (0, exec_1.exec)(codeql, [
        "bqrs",
        "decode",
        "--format=json",
        `--output=${json}`,
        "--entities=all",
        bqrs,
    ]);
    // This will load the whole result set into memory. Given that we just ran a
    // query, we probably have quite a lot of memory available. However, at some
    // point this is likely to break down. We could then look at using a streaming
    // parser such as http://oboejs.com/
    const jsonResults = JSON.parse(await fs_1.default.promises.readFile(json, "utf8"));
    const md = path_1.default.join("results", "results.md");
    const s = fs_1.default.createWriteStream(md, {
        encoding: "utf8",
    });
    await (0, interpret_1.interpret)(s, jsonResults, nwo, compatibleQueryKinds, sourceLocationPrefix, databaseSHA);
    return [md];
}
// Generates results.sarif from the given bqrs file, if query kind supports it
async function outputSarif(codeql, bqrs, compatibleQueryKinds, databaseName, sourceLocationPrefix) {
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
    const sarif = path_1.default.join("results", "results.sarif");
    await (0, exec_1.exec)(codeql, [
        "bqrs",
        "interpret",
        "--format=sarif-latest",
        `--output=${sarif}`,
        `-t=kind=${kind}`,
        "-t=id=remote-query",
        "--sarif-add-file-contents",
        // Hard-coded the source archive as src.zip inside the database, since that's
        // where the CLI puts it. If this changes, we need to update this path.
        `--source-archive=${databaseName}/src.zip`,
        `--source-location-prefix=${sourceLocationPrefix}`,
        bqrs,
    ]);
    return [sarif];
}
// Generates results count
async function outputResultCount(bqrsInfo) {
    const count = path_1.default.join("results", "resultcount.txt");
    // find the rows for the result set with name "#select"
    const selectResultSet = bqrsInfo.resultSets.find((resultSet) => resultSet.name === "#select");
    if (!selectResultSet) {
        throw new Error("No result set named #select");
    }
    await fs_1.default.promises.writeFile(count, selectResultSet.rows.toString(), "utf8");
    return [count];
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
//# sourceMappingURL=codeql.js.map