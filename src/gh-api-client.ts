/* eslint-disable @typescript-eslint/naming-convention */

import * as httpm from "@actions/http-client";

const userAgent = "GitHub multi-repository variant analysis action";

export function getApiClient() {
  return new httpm.HttpClient(userAgent, [], {
    allowRetries: true,
  });
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
  variantAnalysisId: number,
  repoId: number
): Promise<void> {
  await updateVariantAnalysisStatus(variantAnalysisId, repoId, {
    status: "in_progress",
  });
}

export async function setVariantAnalysisRepoSucceeded(
  variantAnalysisId: number,
  repoId: number,
  sourceLocationPrefix: string,
  resultCount: number,
  databaseCommitSha: string
): Promise<void> {
  await updateVariantAnalysisStatus(variantAnalysisId, repoId, {
    status: "succeeded",
    source_location_prefix: sourceLocationPrefix,
    result_count: resultCount,
    database_commit_sha: databaseCommitSha,
  });
}

export async function setVariantAnalysisFailed(
  variantAnalysisId: number,
  repoId: number,
  failureMessage: string
): Promise<void> {
  await updateVariantAnalysisStatus(variantAnalysisId, repoId, {
    status: "failed",
    failure_message: failureMessage,
  });
}

async function updateVariantAnalysisStatus(
  variantAnalysisId: number,
  repoId: number,
  data: UpdateVariantAnalysis
): Promise<void> {
  const http = getApiClient();

  const url = `/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}`;
  const response = await http.patch(url, JSON.stringify(data));
  if (response.message.statusCode !== 204) {
    console.log(
      `Request to ${url} returned status code ${response.message.statusCode}:
      ${await response.readBody()}`
    );
    throw new Error(
      `Error while setting variant analysis as "${data.status}". Status code: ${response.message.statusCode}`
    );
  }
}

export async function getPolicyForRepoArtifact(
  variantAnalysisId: number,
  repoId: number,
  artifactSize: number
): Promise<string> {
  const data = {
    name: "results.zip",
    content_type: "application/zip",
    size: artifactSize,
  };
  const http = getApiClient();

  const url = `/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/artifact`;
  const response = await http.patch(url, JSON.stringify(data));

  if (response.message.statusCode !== 201) {
    console.log(
      `Request to ${url} returned status code ${response.message.statusCode}:
      ${await response.readBody()}`
    );
    throw new Error(
      `Error while getting policy for artifact. Status code: ${response.message.statusCode}`
    );
  }

  // TODO: Parse the response in a useful way
  return await response.readBody();
}
