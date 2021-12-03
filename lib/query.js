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
const tool_cache_1 = require("@actions/tool-cache");
const codeql_1 = require("./codeql");
const download_1 = require("./download");
async function run() {
    const artifactClient = (0, artifact_1.create)();
    try {
        const queryPackUrl = (0, core_1.getInput)("query_pack_url", { required: true });
        const language = (0, core_1.getInput)("language", { required: true });
        const repos = JSON.parse((0, core_1.getInput)("repositories", { required: true }));
        const codeql = (0, core_1.getInput)("codeql", { required: true });
        for (const repo of repos) {
            if (repo.token) {
                (0, core_1.setSecret)(repo.token);
            }
            if (repo.pat) {
                (0, core_1.setSecret)(repo.pat);
            }
        }
        const curDir = (0, process_1.cwd)();
        for (const repo of repos) {
            const workDir = (0, fs_1.mkdtempSync)(path_1.default.join(curDir, repo.id.toString()));
            (0, process_1.chdir)(workDir);
            // 1. Use the GitHub API to download the database using token
            console.log("Getting database");
            const dbZip = await (0, codeql_1.downloadDatabase)(repo.id, repo.nwo, language, repo.token, repo.pat);
            // 2. Download and extract the query pack.
            console.log("Getting query pack");
            const queryPackArchive = await (0, download_1.download)(queryPackUrl, "query_pack.tar.gz");
            const queryPack = await (0, tool_cache_1.extractTar)(queryPackArchive);
            // 2. Run the query
            console.log("Running query");
            const filesToUpload = await (0, codeql_1.runQuery)(codeql, dbZip, repo.nwo, queryPack);
            // 3. Upload the results as an artifact
            console.log("Uploading artifact");
            await artifactClient.uploadArtifact(repo.id.toString(), // name
            filesToUpload, // files
            "results", // rootdirectory
            { continueOnError: false });
        }
    }
    catch (error) {
        (0, core_1.setFailed)(error.message);
        // Write error messages to a file and upload as an artifact, so that the
        // combine-results job "knows" about the failures
        (0, fs_1.mkdirSync)("errors");
        const errorFile = path_1.default.join((0, process_1.cwd)(), "errors", "error.txt");
        (0, fs_1.appendFileSync)(errorFile, error.message); // TODO: Include information about which repository produced the error
        await artifactClient.uploadArtifact("error", // name
        ["errors/error.txt"], // files
        "errors", // rootdirectory
        { continueOnError: false, retentionDays: 1 });
    }
}
void run();
//# sourceMappingURL=query.js.map