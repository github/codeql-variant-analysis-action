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
async function setVariantAnalysisRepoInProgress(variantAnalysisId, repoId) {
    await updateVariantAnalysisStatus(variantAnalysisId, repoId, {
        status: "in_progress",
    });
}
exports.setVariantAnalysisRepoInProgress = setVariantAnalysisRepoInProgress;
async function setVariantAnalysisRepoSucceeded(variantAnalysisId, repoId, sourceLocationPrefix, resultCount, databaseSHA) {
    await updateVariantAnalysisStatus(variantAnalysisId, repoId, {
        status: "succeeded",
        sourceLocationPrefix,
        resultCount,
        databaseSHA,
    });
}
exports.setVariantAnalysisRepoSucceeded = setVariantAnalysisRepoSucceeded;
async function setVariantAnalysisFailed(variantAnalysisId, repoId, failureMessage) {
    await updateVariantAnalysisStatus(variantAnalysisId, repoId, {
        status: "failed",
        failureMessage,
    });
}
exports.setVariantAnalysisFailed = setVariantAnalysisFailed;
async function updateVariantAnalysisStatus(variantAnalysisId, repoId, data) {
    const http = getApiClient();
    const url = `/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}`;
    const response = await http.patch(url, JSON.stringify(data));
    if (response.message.statusCode !== 204) {
        console.log(`Request to ${url} returned status code ${response.message.statusCode}:
      ${await response.readBody()}`);
        throw new Error(`Error while setting variant analysis as "${data.status}". Status code: ${response.message.statusCode}`);
    }
}
async function getPolicyForRepoArtifact(variantAnalysisId, repoId, artifactSize) {
    const data = {
        name: "results.zip",
        content_type: "application/zip",
        size: artifactSize,
    };
    const http = getApiClient();
    const url = `/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/artifact`;
    const response = await http.patch(url, JSON.stringify(data));
    if (response.message.statusCode !== 201) {
        console.log(`Request to ${url} returned status code ${response.message.statusCode}:
      ${await response.readBody()}`);
        throw new Error(`Error while getting policy for artifact. Status code: ${response.message.statusCode}`);
    }
    // TODO: Parse the response in a useful way
    return await response.readBody();
}
exports.getPolicyForRepoArtifact = getPolicyForRepoArtifact;
//# sourceMappingURL=gh-api-client.js.map