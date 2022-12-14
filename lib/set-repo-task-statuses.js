"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRepoTaskStatuses = void 0;
const gh_api_client_1 = require("./gh-api-client");
const inputs_1 = require("./inputs");
/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
async function setRepoTaskStatuses(repos) {
    const controllerRepoId = (0, inputs_1.getControllerRepoId)();
    const variantAnalysisId = (0, inputs_1.getVariantAnalysisId)();
    const workflowStatus = (0, inputs_1.getWorkflowStatus)();
    const repoIds = repos.map((repo) => repo.id);
    if (workflowStatus === "failed") {
        await (0, gh_api_client_1.setVariantAnalysesFailed)(controllerRepoId, variantAnalysisId, repoIds, "The GitHub Actions workflow failed.");
    }
    if (workflowStatus === "canceled") {
        await (0, gh_api_client_1.setVariantAnalysesCanceled)(controllerRepoId, variantAnalysisId, repoIds);
    }
}
exports.setRepoTaskStatuses = setRepoTaskStatuses;
//# sourceMappingURL=set-repo-task-statuses.js.map