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
exports.getRemoteQueryPackDefaultQuery = exports.getDatabaseSHA = exports.getBqrsInfo = exports.runQuery = exports.downloadDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec_1 = require("@actions/exec");
const yaml = __importStar(require("js-yaml"));
const deserialize_1 = require("./deserialize");
const download_1 = require("./download");
const interpret_1 = require("./interpret");
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
async function runQuery(codeql, language, database, nwo, query, queryPack) {
    const bqrs = path_1.default.join("results", "results.bqrs");
    fs_1.default.mkdirSync("results");
    const nwoFile = path_1.default.join("results", "nwo.txt");
    fs_1.default.writeFileSync(nwoFile, nwo);
    let queryFile;
    if (query !== undefined) {
        const queryDir = "query";
        fs_1.default.mkdirSync("query");
        queryFile = path_1.default.join(queryDir, "query.ql");
        fs_1.default.writeFileSync(path_1.default.join(queryDir, "qlpack.yml"), `name: queries
version: 0.0.0
libraryPathDependencies: codeql-${language}`);
        fs_1.default.writeFileSync(queryFile, query);
    }
    else if (queryPack !== undefined) {
        queryFile = path_1.default.join(queryPack, "query.ql");
    }
    else {
        throw new Error("Exactly one of 'query' and 'queryPack' must be set");
    }
    const databaseName = "db";
    await (0, exec_1.exec)(codeql, [
        "database",
        "unbundle",
        database,
        `--name=${databaseName}`,
    ]);
    const databaseSHA = getDatabaseSHA(databaseName);
    if (query !== undefined) {
        await (0, exec_1.exec)(codeql, [
            "query",
            "run",
            `--database=db`,
            `--output=${bqrs}`,
            queryFile,
        ]);
    }
    else if (queryPack !== undefined) {
        await (0, exec_1.exec)(codeql, [
            "database",
            "run-queries",
            "--additional-packs",
            queryPack,
            "--",
            "db",
            "codeql-remote/query",
        ]);
        let cur = "db/results";
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
    }
    const bqrsInfo = await getBqrsInfo(codeql, bqrs);
    const compatibleQueryKinds = bqrsInfo.compatibleQueryKinds;
    const outputPromises = [
        outputCsv(codeql, bqrs),
        outputMd(codeql, bqrs, nwo, databaseSHA, compatibleQueryKinds),
        outputSarif(codeql, bqrs, compatibleQueryKinds),
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
        return await (0, download_1.download)(`https://api.github.com/repositories/${repoId}/code-scanning/codeql/databases/${language}`, `${repoId}.zip`, authHeader);
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
// Generates results.md from the given bqrs file
async function outputMd(codeql, bqrs, nwo, databaseSHA, compatibleQueryKinds) {
    const json = path_1.default.join("results", "results.json");
    await (0, exec_1.exec)(codeql, [
        "bqrs",
        "decode",
        "--format=json",
        `--output=${json}`,
        "--entities=all",
        bqrs,
    ]);
    const sourceLocationPrefix = JSON.parse((await (0, exec_1.getExecOutput)(codeql, ["resolve", "database", "db"])).stdout).sourceLocationPrefix;
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
async function outputSarif(codeql, bqrs, compatibleQueryKinds) {
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
 * Gets the commit SHA that a database was created from (if the database was created from a git repo).
 * This information is available from CodeQL CLI version 2.7.2 onwards.
 *
 * @param database The name of the database.
 * @returns The commit SHA that the database was created from, or "HEAD" if we can't find the SHA.
 */
function getDatabaseSHA(database) {
    var _a;
    let metadata;
    try {
        metadata = yaml.load(fs_1.default.readFileSync(path_1.default.join(database, "codeql-database.yml"), "utf8"));
    }
    catch (error) {
        console.log(`Unable to read codeql-database.yml: ${error}`);
        return "HEAD";
    }
    const sha = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.creationMetadata) === null || _a === void 0 ? void 0 : _a.sha;
    if (sha) {
        return sha;
    }
    else {
        console.log("Unable to get exact commit SHA for the database. Linking to HEAD commit instead.");
        return "HEAD";
    }
}
exports.getDatabaseSHA = getDatabaseSHA;
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
        "codeql-remote/query",
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