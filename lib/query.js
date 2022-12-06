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
const jszip_1 = __importDefault(require("jszip"));
const azure_client_1 = require("./azure-client");
const codeql_1 = require("./codeql");
const download_1 = require("./download");
const gh_api_client_1 = require("./gh-api-client");
const inputs_1 = require("./inputs");
const query_run_metadata_1 = require("./query-run-metadata");
async function run() {
    const artifactClient = (0, artifact_1.create)();
    const controllerRepoId = (0, inputs_1.getControllerRepoId)();
    const queryPackUrl = (0, core_1.getInput)("query_pack_url", { required: true });
    const language = (0, core_1.getInput)("language", { required: true });
    const repos = (0, inputs_1.getRepos)();
    const codeql = (0, core_1.getInput)("codeql", { required: true });
    const variantAnalysisId = (0, inputs_1.getVariantAnalysisId)();
    const liveResults = !!variantAnalysisId;
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
        if (error instanceof download_1.HTTPError && error.httpStatusCode === 403) {
            (0, core_1.setFailed)(`${error.message}. The query pack is only available for 24 hours. To retry, create a new variant analysis.`);
        }
        else {
            (0, core_1.setFailed)(error.message);
        }
        // Consider all repos to have failed
        for (const repo of repos) {
            if (liveResults) {
                await (0, gh_api_client_1.setVariantAnalysisFailed)(controllerRepoId, variantAnalysisId, repo.id, error.message);
            }
            else {
                const workDir = createTempRepoDir(curDir, repo);
                (0, process_1.chdir)(workDir);
                await uploadError(error, repo, artifactClient);
                (0, process_1.chdir)(curDir);
                fs_1.default.rmdirSync(workDir, { recursive: true });
            }
        }
        return;
    }
    for (const repo of repos) {
        // Create a new directory to contain all files created during analysis of this repo.
        const workDir = createTempRepoDir(curDir, repo);
        // Change into the new directory to further ensure that all created files go in there.
        (0, process_1.chdir)(workDir);
        try {
            if (liveResults) {
                await (0, gh_api_client_1.setVariantAnalysisRepoInProgress)(controllerRepoId, variantAnalysisId, repo.id);
            }
            const dbZip = await getDatabase(repo, language);
            console.log("Running query");
            const runQueryResult = await (0, codeql_1.runQuery)(codeql, dbZip, repo.nwo, queryPack);
            if (liveResults) {
                await uploadRepoResult(controllerRepoId, variantAnalysisId, repo, runQueryResult);
                await (0, gh_api_client_1.setVariantAnalysisRepoSucceeded)(controllerRepoId, variantAnalysisId, repo.id, runQueryResult.sourceLocationPrefix, runQueryResult.resultCount, runQueryResult.databaseSHA || "HEAD");
            }
            else {
                await uploadRepoResultToActions(runQueryResult, artifactClient, repo);
            }
        }
        catch (error) {
            console.error(error);
            if (error instanceof download_1.HTTPError && error.httpStatusCode === 403) {
                (0, core_1.setFailed)(`${error.message}. Database downloads are only available for 24 hours. To retry, create a new variant analysis.`);
            }
            else {
                (0, core_1.setFailed)(error.message);
            }
            if (liveResults) {
                await (0, gh_api_client_1.setVariantAnalysisFailed)(controllerRepoId, variantAnalysisId, repo.id, error.message);
            }
            else {
                await uploadError(error, repo, artifactClient);
            }
        }
        // We can now delete the work dir. All required files have already been uploaded.
        (0, process_1.chdir)(curDir);
        fs_1.default.rmdirSync(workDir, { recursive: true });
    }
}
async function uploadRepoResultToActions(runQueryResult, artifactClient, repo) {
    const filesToUpload = [
        runQueryResult.bqrsFilePath,
        runQueryResult.metadataFilePath,
    ];
    if (runQueryResult.sarifFilePath) {
        filesToUpload.push(runQueryResult.sarifFilePath);
    }
    console.log("Uploading artifact");
    await artifactClient.uploadArtifact(repo.id.toString(), filesToUpload, "results", { continueOnError: false });
}
async function uploadRepoResult(controllerRepoId, variantAnalysisId, repo, runQueryResult) {
    const artifactContents = await getArtifactContentsForUpload(runQueryResult);
    // Get policy for artifact upload
    const policy = await (0, gh_api_client_1.getPolicyForRepoArtifact)(controllerRepoId, variantAnalysisId, repo.id, artifactContents.length);
    // Use Azure client for uploading to Azure Blob Storage
    await (0, azure_client_1.uploadArtifact)(policy, artifactContents);
}
async function getArtifactContentsForUpload(runQueryResult) {
    const zip = new jszip_1.default();
    if (runQueryResult.sarifFilePath) {
        const sarifFileContents = fs_1.default.createReadStream(runQueryResult.sarifFilePath);
        zip.file("results.sarif", sarifFileContents);
    }
    else {
        const bqrsFileContents = fs_1.default.createReadStream(runQueryResult.bqrsFilePath);
        zip.file("results.bqrs", bqrsFileContents);
    }
    return await zip.generateAsync({
        compression: "DEFLATE",
        type: "nodebuffer",
    });
}
async function getDatabase(repo, language) {
    console.log("Getting database");
    if (repo.downloadUrl) {
        // Use the provided signed URL to download the database
        return await (0, download_1.download)(repo.downloadUrl, `${repo.id}.zip`);
    }
    else {
        // Use the GitHub API to download the database using token
        return await (0, codeql_1.downloadDatabase)(repo.id, repo.nwo, language, repo.pat);
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
/**
 * Creates a temporary directory for a given repository.
 * @param curDir The current directory.
 * @param repo The repository to create a temporary directory for.
 * @returns The path to the temporary directory.
 */
function createTempRepoDir(curDir, repo) {
    const workDir = fs_1.default.mkdtempSync(path_1.default.join(curDir, repo.id.toString()));
    return workDir;
}
void run();
//# sourceMappingURL=query.js.map