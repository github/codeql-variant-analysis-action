"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const process_1 = require("process");
const artifact_1 = require("@actions/artifact");
const core_1 = require("@actions/core");
const tool_cache_1 = require("@actions/tool-cache");
const codeql_1 = require("./codeql");
const download_1 = require("./download");
const query_run_metadata_1 = require("./query-run-metadata");
async function run() {
    const artifactClient = (0, artifact_1.create)();
    const queryPackUrl = (0, core_1.getInput)("query_pack_url", { required: true });
    const language = (0, core_1.getInput)("language", { required: true });
    const repos = JSON.parse((0, core_1.getInput)("repositories", { required: true }));
    const codeql = (0, core_1.getInput)("codeql", { required: true });
    for (const repo of repos) {
        if (repo.downloadUrl) {
            (0, core_1.setSecret)(repo.downloadUrl);
        }
        if (repo.pat) {
            (0, core_1.setSecret)(repo.pat);
        }
    }
    const curDir = (0, process_1.cwd)();
    let queryPack;
    try {
        // Download and extract the query pack.
        console.log("Getting query pack");
        const queryPackArchive = await (0, download_1.download)(queryPackUrl, "query_pack.tar.gz");
        queryPack = await (0, tool_cache_1.extractTar)(queryPackArchive);
    }
    catch (error) {
        // Consider all repos to have failed
        (0, core_1.setFailed)(error.message);
        for (const repo of repos) {
            await uploadError(error, repo, artifactClient);
        }
        return;
    }
    for (const repo of repos) {
        try {
            const workDir = fs_1.default.mkdtempSync(path_1.default.join(curDir, repo.id.toString()));
            (0, process_1.chdir)(workDir);
            let dbZip;
            if (repo.downloadUrl) {
                // 1a. Use the provided signed URL to download the database
                console.log("Getting database");
                dbZip = await (0, download_1.download)(repo.downloadUrl, `${repo.id}.zip`);
            }
            else {
                // 1b. Use the GitHub API to download the database using token
                console.log("Getting database");
                dbZip = await (0, codeql_1.downloadDatabase)(repo.id, repo.nwo, language, repo.pat);
            }
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
        catch (error) {
            (0, core_1.setFailed)(error.message);
            await uploadError(error, repo, artifactClient);
        }
    }
}
// Write error messages to a file and upload as an artifact,
// so that the combine-results job "knows" about the failures.
async function uploadError(error, repo, artifactClient) {
    fs_1.default.mkdirSync("errors");
    const errorFilePath = path_1.default.join("errors", "error.txt");
    fs_1.default.appendFileSync(errorFilePath, error.message);
    const metadataFilePath = path_1.default.join("errors", "metadata.json");
    (0, query_run_metadata_1.writeQueryRunMetadataToFile)(metadataFilePath, repo.nwo);
    await artifactClient.uploadArtifact(`${repo.id.toString()}-error`, // name
    [errorFilePath, metadataFilePath], // files
    "errors", // rootdirectory
    { continueOnError: false });
}
void run();
//# sourceMappingURL=query.js.map