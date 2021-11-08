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
exports.getDatabaseSHA = exports.runQuery = exports.downloadDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec_1 = require("@actions/exec");
const yaml = __importStar(require("js-yaml"));
const download_1 = require("./download");
const interpret_1 = require("./interpret");
/**
 * Run a query. Will operate on the current working directory and create the following directories:
 * - query/    (query.ql and any other supporting files)
 * - results/  (results.{bqrs,csv,json,md} and nwo.txt)
 *
 * @param     codeql          The path to the codeql binary
 * @param     language        The language of the query (can be removed once we only use query packs)
 * @param     database        The path to the bundled database zip file
 * @param     nwo             The name of the repository
 * @param     query?          The query to run (specify this XOR a query pack)
 * @param     queryPack?      The path to the query pack (specify this XOR a query)
 * @returns   Promise<void>   Resolves when the query has finished running.
 */
async function runQuery(codeql, language, database, nwo, query, queryPack) {
    const bqrs = path_1.default.join("results", "results.bqrs");
    const json = path_1.default.join("results", "results.json");
    fs_1.default.mkdirSync("results");
    fs_1.default.writeFileSync(path_1.default.join("results", "nwo.txt"), nwo);
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
    await (0, exec_1.exec)(codeql, [
        "query",
        "run",
        `--database=db`,
        `--output=${bqrs}`,
        queryFile,
    ]);
    await Promise.all([
        (0, exec_1.exec)(codeql, [
            "bqrs",
            "decode",
            "--format=csv",
            `--output=${path_1.default.join("results", "results.csv")}`,
            bqrs,
        ]),
        (0, exec_1.exec)(codeql, [
            "bqrs",
            "decode",
            "--format=json",
            `--output=${json}`,
            "--entities=all",
            bqrs,
        ]),
    ]);
    const sourceLocationPrefix = JSON.parse((await (0, exec_1.getExecOutput)(codeql, ["resolve", "database", "db"])).stdout).sourceLocationPrefix;
    // This will load the whole result set into memory. Given that we just ran a
    // query, we probably have quite a lot of memory available. However, at some
    // point this is likely to break down. We could then look at using a streaming
    // parser such as http://oboejs.com/
    const jsonResults = JSON.parse(fs_1.default.readFileSync(json, "utf8"));
    const s = fs_1.default.createWriteStream(path_1.default.join("results", "results.md"), {
        encoding: "utf8",
    });
    await (0, interpret_1.interpret)(s, jsonResults, nwo, sourceLocationPrefix, databaseSHA);
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
/**
 * Gets the commit SHA that a database was created from (if the database was created from a git repo).
 * This information is available from CodeQL CLI version 2.7.2 onwards.
 *
 * @param database The name of the database.
 * @returns The commit SHA that the database was created from, or "HEAD" if we can't find the SHA.
 */
function getDatabaseSHA(database) {
    var _a;
    const metadata = yaml.load(fs_1.default.readFileSync(path_1.default.join(database, "codeql-database.yml"), "utf8")) || undefined;
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
//# sourceMappingURL=codeql.js.map