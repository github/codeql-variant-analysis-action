import { getInstructions } from "./inputs";
import { setRepoTaskStatuses } from "./set-repo-task-statuses";

/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
async function updateRepoTaskStatuses(): Promise<void> {
  const instructions = await getInstructions();
  await setRepoTaskStatuses(instructions.repositories);
}

void updateRepoTaskStatuses();
