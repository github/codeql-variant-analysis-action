"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPolicyForRepoArtifact = exports.setVariantAnalysesCanceled = exports.setVariantAnalysesFailed = exports.setVariantAnalysisFailed = exports.setVariantAnalysisRepoSucceeded = exports.setVariantAnalysisRepoInProgress = exports.getOctokitRequestInterface = exports.userAgent = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const action_1 = require("@octokit/action");
const plugin_retry_1 = require("@octokit/plugin-retry");
const inputs_1 = require("./inputs");
const json_validation_1 = require("./json-validation");
exports.userAgent = "GitHub multi-repository variant analysis action";
function getOctokitRequestInterface() {
    const octokit = new action_1.Octokit({ userAgent: exports.userAgent, retry: plugin_retry_1.retry });
    const signedAuthToken = (0, inputs_1.getSignedAuthToken)();
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
async function setVariantAnalysesFailed(controllerRepoId, variantAnalysisId, repoIds, failureMessage) {
    await updateVariantAnalysisStatuses(controllerRepoId, variantAnalysisId, {
        repository_ids: repoIds,
        status: "failed",
        failure_message: failureMessage,
    });
}
exports.setVariantAnalysesFailed = setVariantAnalysesFailed;
async function setVariantAnalysesCanceled(controllerRepoId, variantAnalysisId, repoIds) {
    await updateVariantAnalysisStatuses(controllerRepoId, variantAnalysisId, {
        repository_ids: repoIds,
        status: "canceled",
    });
}
exports.setVariantAnalysesCanceled = setVariantAnalysesCanceled;
function isRequestError(obj) {
    return typeof (obj === null || obj === void 0 ? void 0 : obj["status"]) === "number";
}
async function updateVariantAnalysisStatus(controllerRepoId, variantAnalysisId, repoId, data) {
    const octokitRequest = getOctokitRequestInterface();
    const url = `PATCH /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/status`;
    try {
        await octokitRequest(url, { data });
    }
    catch (e) {
        if (isRequestError(e)) {
            console.error(`Request to ${url} failed with status code ${e.status}`);
        }
        throw e;
    }
}
async function updateVariantAnalysisStatuses(controllerRepoId, variantAnalysisId, data) {
    const octokitRequest = getOctokitRequestInterface();
    const url = `PATCH /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories`;
    try {
        await octokitRequest(url, { data });
    }
    catch (e) {
        if (isRequestError(e)) {
            console.error(`Request to ${url} failed with status code ${e.status}`);
        }
        throw e;
    }
}
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
        return (0, json_validation_1.validateObject)(response.data, "policy");
    }
    catch (e) {
        if (isRequestError(e)) {
            console.error(`Request to ${url} failed with status code ${e.status}`);
        }
        throw e;
    }
}
exports.getPolicyForRepoArtifact = getPolicyForRepoArtifact;
//# sourceMappingURL=gh-api-client.js.map