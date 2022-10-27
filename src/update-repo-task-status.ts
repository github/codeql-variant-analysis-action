import { getState } from "@actions/core";

import {
  setVariantAnalysisCanceled,
  setVariantAnalysisFailed,
} from "./gh-api-client";
import {
  getControllerRepoId,
  getRepos,
  getVariantAnalysisId,
  getWorkflowStatus,
} from "./inputs";

/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
async function updateRepoTaskStatus(): Promise<void> {
  const controllerRepoId = getControllerRepoId();
  const variantAnalysisId = getVariantAnalysisId();
  const workflowState = getWorkflowStatus();

  if (!controllerRepoId || !variantAnalysisId || !workflowState) {
    return;
  }

  const repos = getRepos();

  for (const repo of repos) {
    if (getState(`repo_${repo.id}_completed`)) {
      continue;
    }

    if (workflowState === "failed") {
      await setVariantAnalysisFailed(
        controllerRepoId,
        variantAnalysisId,
        repo.id,
        "The GitHub Actions workflow failed."
      );
    }

    if (workflowState === "canceled") {
      await setVariantAnalysisCanceled(
        controllerRepoId,
        variantAnalysisId,
        repo.id
      );
    }
  }
}

void updateRepoTaskStatus();
