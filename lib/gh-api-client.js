"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPolicyForRepoArtifact = exports.setVariantAnalysisFailed = exports.setVariantAnalysisRepoSucceeded = exports.setVariantAnalysisRepoInProgress = exports.getOctokit = exports.userAgent = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const action_1 = require("@octokit/action");
const plugin_retry_1 = require("@octokit/plugin-retry");
exports.userAgent = "GitHub multi-repository variant analysis action";
function getOctokit() {
    return new action_1.Octokit({ userAgent: exports.userAgent, retry: plugin_retry_1.retry });
}
exports.getOctokit = getOctokit;
async function setVariantAnalysisRepoInProgress(controllerRepoId, variantAnalysisId, repoId) {
    await updateVariantAnalysisStatus(controllerRepoId, variantAnalysisId, repoId, {
        status: "in_progress",
    });
}
exports.setVariantAnalysisRepoInProgress = setVariantAnalysisRepoInProgress;
async function setVariantAnalysisRepoSucceeded(controllerRepoId, variantAnalysisId, repoId, sourceLocationPrefix, resultCount, databaseCommitSha) {
    await updateVariantAnalysisStatus(controllerRepoId, variantAnalysisId, repoId, {
        status: "succeeded",
        source_location_prefix: sourceLocationPrefix,
        result_count: resultCount,
        database_commit_sha: databaseCommitSha,
    });
}
exports.setVariantAnalysisRepoSucceeded = setVariantAnalysisRepoSucceeded;
async function setVariantAnalysisFailed(controllerRepoId, variantAnalysisId, repoId, failureMessage) {
    await updateVariantAnalysisStatus(controllerRepoId, variantAnalysisId, repoId, {
        status: "failed",
        failure_message: failureMessage,
    });
}
exports.setVariantAnalysisFailed = setVariantAnalysisFailed;
async function updateVariantAnalysisStatus(controllerRepoId, variantAnalysisId, repoId, data) {
    const octokit = getOctokit();
    const url = `PATCH /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}`;
    try {
        await octokit.request(url, { data });
    }
    catch (e) {
        console.error(`Request to ${url} failed with status code ${e.status}`);
        throw e;
    }
}
async function getPolicyForRepoArtifact(controllerRepoId, variantAnalysisId, repoId, artifactSize) {
    const data = {
        name: "results.zip",
        content_type: "application/zip",
        size: artifactSize,
    };
    const octokit = getOctokit();
    const url = `PUT /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/artifact`;
    try {
        const response = await octokit.request(url, { data });
        return response.data;
    }
    catch (e) {
        console.error(`Request to ${url} failed with status code ${e.status}`);
        throw e;
    }
}
exports.getPolicyForRepoArtifact = getPolicyForRepoArtifact;
//# sourceMappingURL=gh-api-client.js.map