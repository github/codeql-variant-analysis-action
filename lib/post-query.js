"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const gh_api_client_1 = require("./gh-api-client");
const inputs_1 = require("./inputs");
async function markAsFailed() {
    const controllerRepoId = (0, inputs_1.getControllerRepoId)();
    const variantAnalysisId = (0, inputs_1.getVariantAnalysisId)();
    if (!controllerRepoId || !variantAnalysisId) {
        return;
    }
    const repos = (0, inputs_1.getRepos)();
    for (const repo of repos) {
        if ((0, core_1.getState)(`repo_${repo.id}_completed`)) {
            continue;
        }
        await (0, gh_api_client_1.setVariantAnalysisFailed)(controllerRepoId, variantAnalysisId, repo.id, "The GitHub Actions workflow failed or was cancelled.");
    }
}
void markAsFailed();
//# sourceMappingURL=post-query.js.map