"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inputs_1 = require("./inputs");
const set_repo_task_statuses_1 = require("./set-repo-task-statuses");
/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
async function updateRepoTaskStatus() {
    const repos = (0, inputs_1.getRepos)();
    await (0, set_repo_task_statuses_1.setRepoTaskStatuses)(repos);
}
void updateRepoTaskStatus();
//# sourceMappingURL=update-repo-task-status.js.map