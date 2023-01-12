/* eslint-disable @typescript-eslint/naming-convention */
import { Octokit } from "@octokit/action";
import { retry } from "@octokit/plugin-retry";
import {
  EndpointOptions,
  RequestError,
  RequestInterface,
} from "@octokit/types";

import { getSignedAuthToken } from "./inputs";
import { validateObject } from "./json-validation";

export const userAgent = "GitHub multi-repository variant analysis action";

export function getOctokitRequestInterface(): RequestInterface {
  const octokit = new Octokit({ userAgent, retry });

  const signedAuthToken = getSignedAuthToken();
  if (signedAuthToken) {
    return octokit.request.defaults({
      request: {
        hook: (request: RequestInterface, options: EndpointOptions) => {
          if (options.headers) {
            options.headers.authorization = `RemoteAuth ${signedAuthToken}`;
          }
          return request(options);
        },
      },
    });
  }

  return octokit.request;
}

export interface Policy {
  upload_url: string;
  header: Record<string, string>;
  form: Record<string, string>;
}

export interface RepoTask {
  analysis_status: AnalysisStatus;
}

export type AnalysisStatus =
  | "pending"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timed_out";

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

interface CanceledAnalysis {
  status: "canceled";
}

type UpdateVariantAnalysis =
  | InProgressAnalysis
  | SuccessfulAnalysis
  | FailedAnalysis
  | CanceledAnalysis;

type UpdateVariantAnalyses = {
  repository_ids: number[];
} & (FailedAnalysis | CanceledAnalysis);

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

export async function setVariantAnalysesFailed(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoIds: number[],
  failureMessage: string
): Promise<void> {
  await updateVariantAnalysisStatuses(controllerRepoId, variantAnalysisId, {
    repository_ids: repoIds,
    status: "failed",
    failure_message: failureMessage,
  });
}

export async function setVariantAnalysesCanceled(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoIds: number[]
): Promise<void> {
  await updateVariantAnalysisStatuses(controllerRepoId, variantAnalysisId, {
    repository_ids: repoIds,
    status: "canceled",
  });
}

function isRequestError(obj: unknown): obj is RequestError {
  return typeof obj?.["status"] === "number";
}

async function updateVariantAnalysisStatus(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
  data: UpdateVariantAnalysis
): Promise<void> {
  const octokitRequest = getOctokitRequestInterface();

  const url = `PATCH /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/status`;
  try {
    await octokitRequest(url, { data });
  } catch (e: unknown) {
    if (isRequestError(e)) {
      console.error(`Request to ${url} failed with status code ${e.status}`);
    }
    throw e;
  }
}

async function updateVariantAnalysisStatuses(
  controllerRepoId: number,
  variantAnalysisId: number,
  data: UpdateVariantAnalyses
): Promise<void> {
  const octokitRequest = getOctokitRequestInterface();

  const url = `PATCH /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories`;
  try {
    await octokitRequest(url, { data });
  } catch (e: unknown) {
    if (isRequestError(e)) {
      console.error(`Request to ${url} failed with status code ${e.status}`);
    }
    throw e;
  }
}

export async function getRepoTask(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number
): Promise<RepoTask> {
  const octokitRequest = getOctokitRequestInterface();

  const url = `GET /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}`;
  try {
    const response = await octokitRequest(url);
    return validateObject(response.data, "repoTask");
  } catch (e: unknown) {
    if (isRequestError(e)) {
      console.error(`Request to ${url} failed with status code ${e.status}`);
    }
    throw e;
  }
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
  const octokitRequest = getOctokitRequestInterface();

  const url = `PUT /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/artifact`;
  try {
    const response = await octokitRequest(url, { data });
    return validateObject(response.data, "policy");
  } catch (e: unknown) {
    if (isRequestError(e)) {
      console.error(`Request to ${url} failed with status code ${e.status}`);
    }
    throw e;
  }
}
