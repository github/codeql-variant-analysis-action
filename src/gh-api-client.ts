/* eslint-disable @typescript-eslint/naming-convention */
import { Octokit } from "@octokit/action";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import {
  EndpointDefaults,
  EndpointOptions,
  RequestError,
  RequestInterface,
} from "@octokit/types";

import { getSignedAuthToken } from "./inputs";
import { validateObject } from "./json-validation";

export const userAgent = "GitHub multi-repository variant analysis action";

function getOctokit(): Octokit {
  const throttlingOctokit = Octokit.plugin(throttling);
  const octokit = new throttlingOctokit({
    userAgent,
    retry,
    authStrategy: () => {
      return {
        hook: (request: RequestInterface, options: EndpointOptions) => {
          if (options.headers) {
            options.headers.authorization = `RemoteAuth ${getSignedAuthToken()}`;
          }
          return request(options);
        },
      };
    },
    throttle: {
      enabled: !!process.env.CODEQL_VARIANT_ANALYSIS_ACTION_WAIT_ON_RATE_LIMIT,
      onRateLimit: (retryAfter: number, options: EndpointDefaults) => {
        console.log(
          `Rate limit exhausted for request ${options.method} ${options.url}, retrying after ${retryAfter} seconds`,
        );
        return true;
      },
      onSecondaryRateLimit: (retryAfter: number, options: EndpointDefaults) => {
        console.log(
          `Secondary rate limit triggered for request ${options.method} ${options.url}, retrying after ${retryAfter} seconds`,
        );
        return true;
      },
    },
  });

  return octokit;
}

export interface Policy {
  upload_url: string;
  header: Record<string, string>;
  form: Record<string, string>;
}

export interface RepoTask {
  analysis_status: AnalysisStatus;
}

type AnalysisStatus =
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
  repoId: number,
): Promise<void> {
  await updateVariantAnalysisStatus(
    controllerRepoId,
    variantAnalysisId,
    repoId,
    {
      status: "in_progress",
    },
  );
}

export async function setVariantAnalysisRepoSucceeded(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
  sourceLocationPrefix: string,
  resultCount: number,
  databaseCommitSha: string,
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
    },
  );
}

export async function setVariantAnalysisFailed(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
  failureMessage: string,
): Promise<void> {
  await updateVariantAnalysisStatus(
    controllerRepoId,
    variantAnalysisId,
    repoId,
    {
      status: "failed",
      failure_message: failureMessage,
    },
  );
}

export async function setVariantAnalysesFailed(
  controllerRepoId: number,
  variantAnalysisId: number,
  repoIds: number[],
  failureMessage: string,
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
  repoIds: number[],
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
  data: UpdateVariantAnalysis,
): Promise<void> {
  const octokit = getOctokit();

  const url = `PATCH /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/status`;
  try {
    await octokit.request(url, { data });
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
  data: UpdateVariantAnalyses,
): Promise<void> {
  const octokit = getOctokit();

  const url = `PATCH /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories`;
  try {
    await octokit.request(url, { data });
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
  artifactSize: number,
): Promise<Policy> {
  const data = {
    name: "results.zip",
    content_type: "application/zip",
    size: artifactSize,
  };
  const octokit = getOctokit();

  const url = `PUT /repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses/${variantAnalysisId}/repositories/${repoId}/artifact`;
  try {
    const response = await octokit.request(url, { data });
    return validateObject(response.data, "policy");
  } catch (e: unknown) {
    if (isRequestError(e)) {
      console.error(`Request to ${url} failed with status code ${e.status}`);
    }
    throw e;
  }
}
