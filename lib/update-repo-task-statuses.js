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
const fs = __importStar(require("fs"));
const inputs_1 = require("./inputs");
const set_repo_task_statuses_1 = require("./set-repo-task-statuses");
/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
async function updateRepoTaskStatuses() {
    const instructionsFilePath = (0, inputs_1.getInstructionsPath)();
    const instructionsContents = await fs.promises.readFile(instructionsFilePath, "utf-8");
    const instructions = JSON.parse(instructionsContents);
    const repos = instructions.repositories;
    await (0, set_repo_task_statuses_1.setRepoTaskStatuses)(repos);
}
void updateRepoTaskStatuses();
//# sourceMappingURL=update-repo-task-statuses.js.map