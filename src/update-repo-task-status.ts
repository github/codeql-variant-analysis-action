import { getRepos } from "./inputs";
import { setRepoTaskStatuses } from "./set-repo-task-statuses";

/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
async function updateRepoTaskStatus(): Promise<void> {
  const repos = getRepos();

  await setRepoTaskStatuses(repos);
}

void updateRepoTaskStatus();
