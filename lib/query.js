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
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const process_1 = require("process");
const artifact_1 = require("@actions/artifact");
const core_1 = require("@actions/core");
const filenamify = __importStar(require("filenamify"));
const codeql_1 = require("./codeql");
async function run() {
    try {
        const query = core_1.getInput("query", { required: true });
        const language = core_1.getInput("language", { required: true });
        const repos = JSON.parse(core_1.getInput("repositories", { required: true }));
        const codeql = core_1.getInput("codeql", { required: true });
        for (const repo of repos) {
            core_1.setSecret(repo.token);
        }
        // 1. Use the GitHub API to download the database using token
        const curDir = process_1.cwd();
        for (const repo of repos) {
            const safeNwo = filenamify.path(repo.nwo);
            const workDir = fs_1.mkdtempSync(path_1.default.join(curDir, safeNwo));
            process_1.chdir(workDir);
            // 1. Use the GitHub API to download the database using token
            const dbZip = await codeql_1.downloadDatabase(repo.token, repo.id, language);
            // 2. Run the query
            await codeql_1.runQuery(codeql, language, dbZip, query, repo.nwo);
            // 3. Upload the results as an artifact
            const artifactClient = artifact_1.create();
            await artifactClient.uploadArtifact(safeNwo, // name
            [
                "results/results.bqrs",
                "results/results.csv",
                "results/results.md",
                "results/nwo.txt",
            ], // files
            "results", // rootdirectory
            { continueOnError: false, retentionDays: 1 });
        }
    }
    catch (error) {
        core_1.setFailed(error.message);
    }
}
void run();
//# sourceMappingURL=query.js.map