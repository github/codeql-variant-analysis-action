"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstructionsPath = exports.getWorkflowStatus = exports.getRepos = exports.getSignedAuthToken = exports.getVariantAnalysisId = exports.getControllerRepoId = void 0;
const core_1 = require("@actions/core");
function getControllerRepoId() {
    return parseInt((0, core_1.getInput)("controller_repo_id", { required: true }));
}
exports.getControllerRepoId = getControllerRepoId;
function getVariantAnalysisId() {
    return parseInt((0, core_1.getInput)("variant_analysis_id"));
}
exports.getVariantAnalysisId = getVariantAnalysisId;
function getSignedAuthToken() {
    return (0, core_1.getInput)("signed_auth_token");
}
exports.getSignedAuthToken = getSignedAuthToken;
function getRepos() {
    return JSON.parse((0, core_1.getInput)("repositories", { required: true }));
}
exports.getRepos = getRepos;
function getWorkflowStatus() {
    return (0, core_1.getInput)("workflow_status", { required: true });
}
exports.getWorkflowStatus = getWorkflowStatus;
function getInstructionsPath() {
    return (0, core_1.getInput)("instructions_path", { required: true });
}
exports.getInstructionsPath = getInstructionsPath;
//# sourceMappingURL=inputs.js.map