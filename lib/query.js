"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const process_1 = require("process");
const artifact_1 = require("@actions/artifact");
const core_1 = require("@actions/core");
const filenamify_1 = __importDefault(require("filenamify"));
const codeql_1 = require("./codeql");
async function run() {
    try {
        const query = core_1.getInput("query", { required: true });
        const language = core_1.getInput("language", { required: true });
        const nwos = JSON.parse(core_1.getInput("repositories", { required: true }));
        const token = core_1.getInput("token", { required: true });
        const codeql = core_1.getInput("codeql", { required: true });
        core_1.setSecret(token);
        const curDir = process_1.cwd();
        for (const nwo of nwos) {
            const safeNwo = filenamify_1.default(nwo);
            const workDir = fs_1.mkdtempSync(path_1.default.join(curDir, safeNwo));
            process_1.chdir(workDir);
            // 1. Use the GitHub API to download the database using token
            const dbZip = await codeql_1.downloadDatabase(token, nwo, language);
            await codeql_1.unbundleDatabase(dbZip);
            // 2. Run the query
            await codeql_1.runQuery(codeql, language, "database", query, nwo);
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