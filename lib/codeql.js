"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQuery = exports.downloadDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec_1 = require("@actions/exec");
const tool_cache_1 = require("@actions/tool-cache");
const interpret_1 = require("./interpret");
const json_result_generated_1 = require("./json-result-generated");
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
    await exec_1.exec(codeql, ["database", "unbundle", database, "--name=db"]);
    await exec_1.exec(codeql, [
        "query",
        "run",
        `--database=db`,
        `--output=${bqrs}`,
        queryFile,
    ]);
    await Promise.all([
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
    const sourceLocationPrefix = JSON.parse((await exec_1.getExecOutput(codeql, ["resolve", "database", "db"])).stdout).sourceLocationPrefix;
    // This will load the whole result set into memory. Given that we just ran a
    // query, we probably have quite a lot of memory available. However, at some
    // point this is likely to break down. We could then look at using a streaming
    // parser such as http://oboejs.com/
    const jsonResults = json_result_generated_1.Convert.toJSONResult(fs_1.default.readFileSync(json, "utf8"));
    const s = fs_1.default.createWriteStream(path_1.default.join("results", "results.md"), {
        encoding: "utf8",
    });
    await interpret_1.interpret(s, jsonResults, nwo, sourceLocationPrefix);
}
exports.runQuery = runQuery;
async function downloadDatabase(token, repoId, language) {
    return tool_cache_1.downloadTool(`https://api.github.com/repositories/${repoId}/code-scanning/codeql/databases/${language}`, undefined, `RemoteAuth ${token}`);
}
exports.downloadDatabase = downloadDatabase;
//# sourceMappingURL=codeql.js.map