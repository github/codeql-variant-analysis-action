import {
  AnalysisStatus,
  getRepoTask,
  setVariantAnalysisCanceled,
  setVariantAnalysisFailed,
} from "./gh-api-client";
import {
  getControllerRepoId,
  getRepos,
  getVariantAnalysisId,
  getWorkflowStatus,
} from "./inputs";

// All states that indicate the repository has been scanned and cannot
// change status anymore.
const COMPLETED_STATES = ["succeeded", "failed", "canceled", "timed_out"];

/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
async function updateRepoTaskStatus(): Promise<void> {
  const controllerRepoId = getControllerRepoId();
  const variantAnalysisId = getVariantAnalysisId();
  const workflowStatus = getWorkflowStatus();

  if (!controllerRepoId || !variantAnalysisId || !workflowStatus) {
    return;
  }

  const repos = getRepos();

  for (const repo of repos) {
    const repoTask = await getRepoTask(
      controllerRepoId,
      variantAnalysisId,
      repo.id
    );
    const repoTaskStatus = repoTask.analysis_status;

    if (isCompleted(repoTaskStatus)) {
      continue;
    }

    if (workflowStatus === "failed") {
      await setVariantAnalysisFailed(
        controllerRepoId,
        variantAnalysisId,
        repo.id,
        "The GitHub Actions workflow failed."
      );
    }

    if (workflowStatus === "canceled") {
      await setVariantAnalysisCanceled(
        controllerRepoId,
        variantAnalysisId,
        repo.id
      );
    }
  }
}

/**
 * @param repoTaskstatus
 * @returns whether the repo is in a completed state, i.e. it cannot normally change state anymore
 */
function isCompleted(repoTaskstatus: AnalysisStatus): boolean {
  return COMPLETED_STATES.includes(repoTaskstatus);
}

void updateRepoTaskStatus();
