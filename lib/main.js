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
const artifact = __importStar(require("@actions/artifact"));
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const tc = __importStar(require("@actions/tool-cache"));
// Will create a directory 'database' in the current working directory
async function unbundleDatabase(dbZip) {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    const cwd = process.cwd();
    console.log(cwd);
    const x = path_1.default.resolve(dbZip);
    console.log(x);
    try {
        const db = await tc.extractZip(dbZip, tmpDir);
        const dirs = fs_1.default.readdirSync(db);
        if (dirs.length !== 1 ||
            !fs_1.default.statSync(path_1.default.join(db, dirs[0])).isDirectory()) {
            throw new Error(`Expected a single top-level folder in the database bundle ${db}, found ${dirs}`);
        }
        fs_1.default.renameSync(path_1.default.join(db, dirs[0]), "database");
    }
    finally {
        fs_1.default.rmdirSync(tmpDir);
    }
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
    await exec.exec(path_1.default.join(__dirname, "json2md.py"), [
        json,
        "--nwo",
        nwo,
        "--src",
        sourceLocationPrefix,
        `--output=${path_1.default.join("results", "results.md")}`,
    ]);
}
exports.runQuery = runQuery;
async function downloadDatabase(token, nwo, language) {
    return tc.downloadTool(`https://api.github.com/repos/${nwo}/code-scanning/codeql/databases/${language}`, undefined, `token ${token}`);
}
exports.downloadDatabase = downloadDatabase;
async function run() {
    try {
        const query = core.getInput("query", { required: true });
        const language = core.getInput("language", { required: true });
        const nwo = core.getInput("repository", { required: true });
        const token = core.getInput("token", { required: true });
        const codeql = core.getInput("codeql", { required: true });
        core.setSecret(token);
        // 1. Use the GitHub API to download the database using token
        // TODO: Test this locally
        const dbZip = await downloadDatabase(token, nwo, language);
        await unbundleDatabase(dbZip);
        // 2. Run the query
        await runQuery(codeql, language, "database", query, nwo);
        await exec.exec("ls", ["-R"]);
        // 3. Upload the results as an artifact
        const artifactClient = artifact.create();
        await artifactClient.uploadArtifact(nwo.replace("/", "#"), // name
        ["results/results.bqrs", "results/results.csv", "results/results.md"], // files
        "results", // rootdirectory
        { continueOnError: false, retentionDays: 1 });
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
void run();
//# sourceMappingURL=main.js.map