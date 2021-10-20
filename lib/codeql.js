"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQuery = exports.downloadDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec_1 = require("@actions/exec");
const download_database_1 = require("./download-database");
const interpret_1 = require("./interpret");
// Will operate on the current working directory and create the following
// directories:
// * query/    (query.ql and any other supporting files)
// * results/  (results.{bqrs,csv,json,md} and nwo.txt)
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
    await (0, exec_1.exec)(codeql, ["database", "unbundle", database, "--name=db"]);
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
    await (0, interpret_1.interpret)(s, jsonResults, nwo, sourceLocationPrefix, "HEAD");
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
        return await (0, download_database_1.downloadDatabaseFile)(`https://api.github.com/repositories/${repoId}/code-scanning/codeql/databases/${language}`, `${repoId}.zip`, authHeader);
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
//# sourceMappingURL=codeql.js.map