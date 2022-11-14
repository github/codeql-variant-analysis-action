import * as fs from "fs";

import { getInstructionsPath, Repo } from "./inputs";
import { setRepoTaskStatuses } from "./set-repo-task-statuses";

/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
async function updateRepoTaskStatuses(): Promise<void> {
  const instructionsFilePath = getInstructionsPath();
  const instructionsContents = await fs.promises.readFile(
    instructionsFilePath,
    "utf-8"
  );
  const instructions = JSON.parse(instructionsContents);

  const repos: Repo[] = instructions.repositories;

  await setRepoTaskStatuses(repos);
}

void updateRepoTaskStatuses();
