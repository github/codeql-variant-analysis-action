import { getState } from "@actions/core";

import { setVariantAnalysisFailed } from "./gh-api-client";
import { getControllerRepoId, getRepos, getVariantAnalysisId } from "./inputs";

async function markAsFailed(): Promise<void> {
  const controllerRepoId = getControllerRepoId();
  const variantAnalysisId = getVariantAnalysisId();

  if (!controllerRepoId || !variantAnalysisId) {
    return;
  }

  const repos = getRepos();

  for (const repo of repos) {
    if (getState(`repo_${repo.id}_completed`)) {
      continue;
    }

    await setVariantAnalysisFailed(
      controllerRepoId,
      variantAnalysisId,
      repo.id,
      "The GitHub Actions workflow failed or was cancelled."
    );
  }
}

void markAsFailed();
