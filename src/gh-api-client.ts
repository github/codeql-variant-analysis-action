import * as httpm from "@actions/http-client";

const userAgent = "GitHub multi-repository variant analysis action";

export function getApiClient() {
  return new httpm.HttpClient(userAgent, [], {
    allowRetries: true,
  });
}

interface InProgressProperties {
  status: "in_progress";
}

interface SuccessProperties {
  status: "succeeded";
  sourceLocationPrefix: string;
  resultCount: number;
  databaseSHA: string;
}

interface FailureProperties {
  status: "failed";
  failureMessage: string;
}

type UpdateVariantAnalysisProperties =
  | InProgressProperties
  | SuccessProperties
  | FailureProperties;

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
  databaseSHA: string
): Promise<void> {
  await updateVariantAnalysisStatus(variantAnalysisId, repoId, {
    status: "succeeded",
    sourceLocationPrefix,
    resultCount,
    databaseSHA,
  });
}

export async function setVariantAnalysisFailed(
  variantAnalysisId: number,
  repoId: number,
  failureMessage: string
): Promise<void> {
  await updateVariantAnalysisStatus(variantAnalysisId, repoId, {
    status: "failed",
    failureMessage,
  });
}

async function updateVariantAnalysisStatus(
  variantAnalysisId: number,
  repoId: number,
  data: UpdateVariantAnalysisProperties
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
