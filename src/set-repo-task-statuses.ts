import {
  setVariantAnalysesCanceled,
  setVariantAnalysesFailed,
} from "./gh-api-client";
import {
  getControllerRepoId,
  getVariantAnalysisId,
  getWorkflowStatus,
  Repo,
} from "./inputs";

/**
 * If the overall variant analysis workflow failed or was canceled,
 * propagate the failure/cancellation status to the individual repo tasks.
 */
export async function setRepoTaskStatuses(repos: Repo[]): Promise<void> {
  const controllerRepoId = getControllerRepoId();
  const variantAnalysisId = getVariantAnalysisId();
  const workflowStatus = getWorkflowStatus();

  const repoIds = repos.map((repo) => repo.id);

  if (workflowStatus === "failed") {
    await setVariantAnalysesFailed(
      controllerRepoId,
      variantAnalysisId,
      repoIds,
      "The GitHub Actions workflow failed.",
    );
  }

  if (workflowStatus === "canceled") {
    await setVariantAnalysesCanceled(
      controllerRepoId,
      variantAnalysisId,
      repoIds,
    );
  }
}
