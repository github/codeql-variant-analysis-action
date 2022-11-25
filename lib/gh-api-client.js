"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPolicyForRepoArtifact = exports.getRepoTask = exports.setVariantAnalysisCanceled = exports.setVariantAnalysisFailed = exports.setVariantAnalysisRepoSucceeded = exports.setVariantAnalysisRepoInProgress = exports.getOctokitRequestInterface = exports.userAgent = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const action_1 = require("@octokit/action");
const plugin_retry_1 = require("@octokit/plugin-retry");
const inputs_1 = require("./inputs");
const json_validation_1 = require("./json-validation");
exports.userAgent = "GitHub multi-repository variant analysis action";
function getOctokitRequestInterface() {
    const octokit = new action_1.Octokit({ userAgent: exports.userAgent, retry: plugin_retry_1.retry });
    const signedAuthToken = (0, inputs_1.getSignedAuthToken)();
    if (signedAuthToken) {
        return octokit.request.defaults({
            request: {
                hook: (request, options) => {
                    if (options.headers) {
                        options.headers.authorization = `RemoteAuth ${signedAuthToken}`;
                    }
                    return request(options);
                },
            },
        });
    }
    return octokit.request;
}
exports.getOctokitRequestInterface = getOctokitRequestInterface;
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
async function setVariantAnalysisCanceled(controllerRepoId, variantAnalysisId, repoId) {
    await updateVariantAnalysisStatus(controllerRepoId, variantAnalysisId, repoId, {
        status: "canceled",
    });
}
exports.setVariantAnalysisCanceled = setVariantAnalysisCanceled;
async function updateVariantAnalysisStatus(controllerRepoId, variantAnalysisId, repoId, data) {
    const octokitRequest = getOctokitRequestInterface();
    const url = `PATCH /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}`;
    try {
        await octokitRequest(url, { data });
    }
    catch (e) {
        console.error(`Request to ${url} failed with status code ${e.status}`);
        throw e;
    }
}
async function getRepoTask(controllerRepoId, variantAnalysisId, repoId) {
    const octokitRequest = getOctokitRequestInterface();
    const url = `GET /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}`;
    try {
        const response = await octokitRequest(url);
        return (0, json_validation_1.validateObject)(response.data, "repoTask");
    }
    catch (e) {
        console.error(`Request to ${url} failed with status code ${e.status}`);
        throw e;
    }
}
exports.getRepoTask = getRepoTask;
async function getPolicyForRepoArtifact(controllerRepoId, variantAnalysisId, repoId, artifactSize) {
    const data = {
        name: "results.zip",
        content_type: "application/zip",
        size: artifactSize,
    };
    const octokitRequest = getOctokitRequestInterface();
    const url = `PUT /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/artifact`;
    try {
        const response = await octokitRequest(url, { data });
        return response.data;
    }
    catch (e) {
        console.error(`Request to ${url} failed with status code ${e.status}`);
        throw e;
    }
}
exports.getPolicyForRepoArtifact = getPolicyForRepoArtifact;
//# sourceMappingURL=gh-api-client.js.map