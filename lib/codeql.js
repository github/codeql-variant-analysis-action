"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQuery = exports.unbundleDatabase = exports.downloadDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec_1 = require("@actions/exec");
const tool_cache_1 = require("@actions/tool-cache");
const interpret_1 = require("./interpret");
class DatabaseUnpackingError extends Error {
}
// Will create a directory 'database' in the current working directory
async function unbundleDatabase(dbZip) {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    // extractZip runs in `dest` (tmpDir) and so dbZip must be an absolute path
    const db = await tool_cache_1.extractZip(path_1.default.resolve(dbZip), tmpDir);
    const dirs = fs_1.default.readdirSync(db);
    if (dirs.length !== 1 || !fs_1.default.statSync(path_1.default.join(db, dirs[0])).isDirectory()) {
        throw new DatabaseUnpackingError(`Expected a single top-level folder in the database bundle ${db}, found ${dirs}`);
    }
    fs_1.default.renameSync(path_1.default.join(db, dirs[0]), "database");
}
exports.unbundleDatabase = unbundleDatabase;
// Will operate on the current working directory and create the following
// directories:
// * query/    (query.ql and any other supporting files)
// * results/  (results.{bqrs,csv,json,md})
async function runQuery(codeql, language, database, query, nwo) {
    const bqrs = path_1.default.join("results", "results.bqrs");
    const json = path_1.default.join("results", "results.json");
    fs_1.default.mkdirSync("results");
    const queryDir = "query";
    fs_1.default.mkdirSync("query");
    const queryFile = path_1.default.join(queryDir, "query.ql");
    fs_1.default.writeFileSync(path_1.default.join(queryDir, "qlpack.yml"), `name: queries
version: 0.0.0
libraryPathDependencies: codeql-${language}`);
    fs_1.default.writeFileSync(queryFile, query);
    await exec_1.exec(codeql, [
        "query",
        "run",
        `--database=${database}`,
        `--output=${bqrs}`,
        queryFile,
    ]);
    Promise.all([
        exec_1.exec(codeql, [
            "bqrs",
            "decode",
            "--format=csv",
            `--output=${path_1.default.join("results", "results.csv")}`,
            bqrs,
        ]),
        exec_1.exec(codeql, [
            "bqrs",
            "decode",
            "--format=json",
            `--output=${json}`,
            "--entities=all",
            bqrs,
        ]),
    ]);
    const sourceLocationPrefix = JSON.parse((await exec_1.getExecOutput(codeql, ["resolve", "database", database])).stdout).sourceLocationPrefix;
    // This will load the whole result set into memory. Given that we just ran a
    // query, we probably have quite a lot of memory available. However, at some
    // point this is likely to break down. We could then look at using a streaming
    // parser such as http://oboejs.com/
    const jsonResults = JSON.parse(fs_1.default.readFileSync(json, "utf8"));
    const s = fs_1.default.createWriteStream(path_1.default.join("results", "results.md"), {
        encoding: "utf8",
    });
    await interpret_1.interpret(s, jsonResults, nwo, sourceLocationPrefix);
}
exports.runQuery = runQuery;
async function downloadDatabase(token, nwo, language) {
    return tool_cache_1.downloadTool(`https://api.github.com/repos/${nwo}/code-scanning/codeql/databases/${language}`, undefined, `token ${token}`);
}
exports.downloadDatabase = downloadDatabase;
//# sourceMappingURL=codeql.js.map