/* eslint-disable @typescript-eslint/naming-convention */
import { Octokit } from "@octokit/action";
import { retry } from "@octokit/plugin-retry";

export const userAgent = "GitHub multi-repository variant analysis action";

export function getOctokit() {
  return new Octokit({ userAgent, retry });
}

export interface Policy {
  upload_url: string;
  header: Record<string, string>;
  form: Record<string, string>;
}

interface InProgressAnalysis {
  status: "in_progress";
}

interface SuccessfulAnalysis {
  status: "succeeded";
  source_location_prefix: string;
  result_count: number;
  database_commit_sha: string;
}

interface FailedAnalysis {
  status: "failed";
  failure_message: string;
}

type UpdateVariantAnalysis =
  | InProgressAnalysis
  | SuccessfulAnalysis
  | FailedAnalysis;

export async function setVariantAnalysisRepoInProgress(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number
): Promise<void> {
  await updateVariantAnalysisStatus(
    controllerRepoId,
    variantAnalysisId,
    repoId,
    {
      status: "in_progress",
    }
  );
}

export async function setVariantAnalysisRepoSucceeded(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
  sourceLocationPrefix: string,
  resultCount: number,
  databaseCommitSha: string
): Promise<void> {
  await updateVariantAnalysisStatus(
    controllerRepoId,
    variantAnalysisId,
    repoId,
    {
      status: "succeeded",
      source_location_prefix: sourceLocationPrefix,
      result_count: resultCount,
      database_commit_sha: databaseCommitSha,
    }
  );
}

export async function setVariantAnalysisFailed(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
  failureMessage: string
): Promise<void> {
  await updateVariantAnalysisStatus(
    controllerRepoId,
    variantAnalysisId,
    repoId,
    {
      status: "failed",
      failure_message: failureMessage,
    }
  );
}

async function updateVariantAnalysisStatus(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
  data: UpdateVariantAnalysis
): Promise<void> {
  const octokit = getOctokit();

  const url = `PATCH /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}`;
  await octokit.request(url, { data });
}

export async function getPolicyForRepoArtifact(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
  artifactSize: number
): Promise<Policy> {
  const data = {
    name: "results.zip",
    content_type: "application/zip",
    size: artifactSize,
  };
  const octokit = getOctokit();

  const url = `PATCH /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/artifact`;
  const response = await octokit.request(url, { data });

  return response.data;
}
