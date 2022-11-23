"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
exports.getInstructions = exports.getWorkflowStatus = exports.getRepos = exports.getSignedAuthToken = exports.getVariantAnalysisId = exports.getControllerRepoId = void 0;
const fs = __importStar(require("fs"));
const core_1 = require("@actions/core");
const json_validation_1 = require("./json-validation");
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
    const repos = JSON.parse((0, core_1.getInput)("repositories", { required: true }));
    return (0, json_validation_1.validateObject)(repos, "repoArray");
}
exports.getRepos = getRepos;
function getWorkflowStatus() {
    return (0, core_1.getInput)("workflow_status", { required: true });
}
exports.getWorkflowStatus = getWorkflowStatus;
async function getInstructions() {
    const filePath = (0, core_1.getInput)("instructions_path", { required: true });
    const instructions = JSON.parse(await fs.promises.readFile(filePath, "utf-8"));
    return (0, json_validation_1.validateObject)(instructions, "instructions");
}
exports.getInstructions = getInstructions;
//# sourceMappingURL=inputs.js.map