"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRepoTaskStatuses = void 0;
// All states that indicate the repository has been scanned and cannot
// change status anymore.
const gh_api_client_1 = require("./gh-api-client");
const inputs_1 = require("./inputs");
const PENDING_STATES = ["pending", "in_progress"];
/**
 * @param repoTaskstatus
 * @returns whether the repo is in a completed state, i.e. it cannot normally change state anymore
 */
function isCompleted(repoTaskstatus) {
    return !PENDING_STATES.includes(repoTaskstatus);
}
/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
async function setRepoTaskStatuses(repos) {
    const controllerRepoId = (0, inputs_1.getControllerRepoId)();
    const variantAnalysisId = (0, inputs_1.getVariantAnalysisId)();
    const workflowStatus = (0, inputs_1.getWorkflowStatus)();
    for (const repo of repos) {
        const repoTask = await (0, gh_api_client_1.getRepoTask)(controllerRepoId, variantAnalysisId, repo.id);
        const repoTaskStatus = repoTask.analysis_status;
        if (isCompleted(repoTaskStatus)) {
            continue;
        }
        if (workflowStatus === "failed") {
            await (0, gh_api_client_1.setVariantAnalysisFailed)(controllerRepoId, variantAnalysisId, repo.id, "The GitHub Actions workflow failed.");
        }
        if (workflowStatus === "canceled") {
            await (0, gh_api_client_1.setVariantAnalysisCanceled)(controllerRepoId, variantAnalysisId, repo.id);
        }
    }
}
exports.setRepoTaskStatuses = setRepoTaskStatuses;
//# sourceMappingURL=set-repo-task-statuses.js.map