"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQuery = exports.downloadDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec_1 = require("@actions/exec");
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
    await (0, exec_1.exec)(codeql, ["database", "unbundle", database, "--name=db"]);
    await (0, exec_1.exec)(codeql, [
        "query",
        "run",
        `--database=db`,
        `--output=${bqrs}`,
        queryFile,
    ]);
    const compatibleQueryKinds = await getCompatibleQueryKinds(codeql, bqrs);
    const outputPromises = [
        outputCsv(codeql, bqrs),
        outputMd(codeql, bqrs, nwo, compatibleQueryKinds),
    ];
    if (compatibleQueryKinds.includes("Problem")) {
        outputPromises.push(outputSarif(codeql, bqrs));
    }
    return [bqrs, nwoFile].concat(await Promise.all(outputPromises));
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
// Calls `bqrs info` and returns compatible query kinds for the given bqrs file
async function getCompatibleQueryKinds(codeql, bqrs) {
    const bqrsInfoOutput = await (0, exec_1.getExecOutput)(codeql, [
        "bqrs",
        "info",
        "--format=json",
        bqrs,
    ]);
    if (bqrsInfoOutput.exitCode !== 0) {
        throw new Error(`Unable to run codeql bqrs info. Exit code: ${bqrsInfoOutput.exitCode}`);
    }
    return JSON.parse(bqrsInfoOutput.stdout)["compatible-query-kinds"];
}
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
    return csv;
}
// Generates results.md from the given bqrs file
async function outputMd(codeql, bqrs, nwo, compatibleQueryKinds) {
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
    const jsonResults = JSON.parse(fs_1.default.readFileSync(json, "utf8"));
    const md = path_1.default.join("results", "results.md");
    const s = fs_1.default.createWriteStream(md, {
        encoding: "utf8",
    });
    await (0, interpret_1.interpret)(s, jsonResults, nwo, compatibleQueryKinds, sourceLocationPrefix, "HEAD");
    return md;
}
// Generates results.sarif from the given bqrs file
async function outputSarif(codeql, bqrs) {
    const sarif = path_1.default.join("results", "results.sarif");
    await (0, exec_1.exec)(codeql, [
        "bqrs",
        "interpret",
        "--format=sarif-latest",
        `--output=${sarif}`,
        "-t=kind=problem",
        "-t=id=remote-query",
        bqrs,
    ]);
    return sarif;
}
//# sourceMappingURL=codeql.js.map