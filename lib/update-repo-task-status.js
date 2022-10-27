"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const gh_api_client_1 = require("./gh-api-client");
const inputs_1 = require("./inputs");
/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
async function updateRepoTaskStatus() {
    const controllerRepoId = (0, inputs_1.getControllerRepoId)();
    const variantAnalysisId = (0, inputs_1.getVariantAnalysisId)();
    const workflowState = (0, inputs_1.getWorkflowStatus)();
    if (!controllerRepoId || !variantAnalysisId || !workflowState) {
        return;
    }
    const repos = (0, inputs_1.getRepos)();
    for (const repo of repos) {
        if ((0, core_1.getState)(`repo_${repo.id}_completed`)) {
            continue;
        }
        if (workflowState === "failed") {
            await (0, gh_api_client_1.setVariantAnalysisFailed)(controllerRepoId, variantAnalysisId, repo.id, "The GitHub Actions workflow failed.");
        }
        if (workflowState === "canceled") {
            await (0, gh_api_client_1.setVariantAnalysisCanceled)(controllerRepoId, variantAnalysisId, repo.id);
        }
    }
}
void updateRepoTaskStatus();
//# sourceMappingURL=update-repo-task-status.js.map