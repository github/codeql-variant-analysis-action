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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPolicyForRepoArtifact = exports.setVariantAnalysisFailed = exports.setVariantAnalysisRepoSucceeded = exports.setVariantAnalysisRepoInProgress = exports.getApiClient = void 0;
const httpm = __importStar(require("@actions/http-client"));
const userAgent = "GitHub multi-repository variant analysis action";
function getApiClient() {
    return new httpm.HttpClient(userAgent, [], {
        allowRetries: true,
    });
}
exports.getApiClient = getApiClient;
const GH_DOTCOM_API_URL = "https://api.github.com";
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
    const http = getApiClient();
    const url = `${GH_DOTCOM_API_URL}/repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}`;
    const response = await http.patch(url, JSON.stringify(data));
    if (response.message.statusCode !== 204) {
        console.log(`Request to ${url} returned status code ${response.message.statusCode}:
      ${await response.readBody()}`);
        throw new Error(`Error while setting variant analysis as "${data.status}". Status code: ${response.message.statusCode}`);
    }
}
async function getPolicyForRepoArtifact(controllerRepoId, variantAnalysisId, repoId, artifactSize) {
    const data = {
        name: "results.zip",
        content_type: "application/zip",
        size: artifactSize,
    };
    const http = getApiClient();
    const url = `${GH_DOTCOM_API_URL}/repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/artifact`;
    const response = await http.patch(url, JSON.stringify(data));
    if (response.message.statusCode !== 201) {
        console.log(`Request to ${url} returned status code ${response.message.statusCode}:
      ${await response.readBody()}`);
        throw new Error(`Error while getting policy for artifact. Status code: ${response.message.statusCode}`);
    }
    return JSON.parse(await response.readBody());
}
exports.getPolicyForRepoArtifact = getPolicyForRepoArtifact;
//# sourceMappingURL=gh-api-client.js.map