"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepos = exports.getVariantAnalysisId = exports.getControllerRepoId = void 0;
const core_1 = require("@actions/core");
function getControllerRepoId() {
    return parseInt((0, core_1.getInput)("controller_repo_id"));
}
exports.getControllerRepoId = getControllerRepoId;
function getVariantAnalysisId() {
    return parseInt((0, core_1.getInput)("variant_analysis_id"));
}
exports.getVariantAnalysisId = getVariantAnalysisId;
function getRepos() {
    return JSON.parse((0, core_1.getInput)("repositories", { required: true }));
}
exports.getRepos = getRepos;
//# sourceMappingURL=inputs.js.map