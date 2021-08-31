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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQuery = exports.unbundleDatabase = exports.downloadDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec = __importStar(require("@actions/exec"));
const tc = __importStar(require("@actions/tool-cache"));
const interpret_1 = require("./interpret");
const json_result_generated_1 = require("./json-result-generated");
// Will create a directory 'database' in the current working directory
async function unbundleDatabase(dbZip) {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    // extractZip runs in `dest` (tmpDir) and so dbZip must be an absolute path
    const db = await tc.extractZip(path_1.default.resolve(dbZip), tmpDir);
    const dirs = fs_1.default.readdirSync(db);
    if (dirs.length !== 1 || !fs_1.default.statSync(path_1.default.join(db, dirs[0])).isDirectory()) {
        throw new Error(`Expected a single top-level folder in the database bundle ${db}, found ${dirs}`);
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
    await exec.exec(codeql, [
        "query",
        "run",
        `--database=${database}`,
        `--output=${bqrs}`,
        queryFile,
    ]);
    await exec.exec(codeql, [
        "bqrs",
        "decode",
        "--format=csv",
        `--output=${path_1.default.join("results", "results.csv")}`,
        bqrs,
    ]);
    await exec.exec(codeql, [
        "bqrs",
        "decode",
        "--format=json",
        `--output=${json}`,
        "--entities=all",
        bqrs,
    ]);
    const sourceLocationPrefix = JSON.parse((await exec.getExecOutput(codeql, ["resolve", "database", database])).stdout).sourceLocationPrefix;
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
async function downloadDatabase(token, nwo, language) {
    return tc.downloadTool(`https://api.github.com/repos/${nwo}/code-scanning/codeql/databases/${language}`, undefined, `token ${token}`);
}
exports.downloadDatabase = downloadDatabase;
//# sourceMappingURL=codeql.js.map