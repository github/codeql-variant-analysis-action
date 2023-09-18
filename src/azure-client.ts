import * as core from "@actions/core";
import FormData from "form-data";

import { getApiClient } from "./api-client";
import { Policy } from "./gh-api-client";
import { HTTPError } from "./http-error";
import { RetryHelper } from "./retry-helper";

export async function uploadArtifact(
  policy: Policy,
  artifactContents: Buffer,
): Promise<void> {
  const maxAttempts = 3;
  const minSeconds = 10;
  const maxSeconds = 20;
  const retryHelper = new RetryHelper(maxAttempts, minSeconds, maxSeconds);
  return await retryHelper.execute(
    async () => {
      return await uploadArtifactImpl(policy, artifactContents);
    },
    (err: Error) => {
      if (err instanceof HTTPError && err.httpStatusCode) {
        // Only retry 504
        return err.httpStatusCode === 504;
      }

      // Otherwise abort
      return false;
    },
  );
}

async function uploadArtifactImpl(policy: Policy, artifactContents: Buffer) {
  const data = new FormData();
  for (const [key, value] of Object.entries(policy.form)) {
    data.append(key, value);
  }

  data.append("file", artifactContents, {
    contentType: "application/zip",
    filename: "results.zip",
  });

  const httpClient = getApiClient();

  const additionalHeaders = {
    ...policy.header,
    ...data.getHeaders(),
  };

  const response = await httpClient.sendStream(
    "POST",
    policy.upload_url,
    data,
    additionalHeaders,
  );

  if (!response.message.statusCode || response.message.statusCode > 299) {
    const responseBody = await response.readBody();
    core.warning(
      `Request to ${policy.upload_url} returned status code ${response.message.statusCode}: ${responseBody}`,
    );
    throw new HTTPError(response.message.statusCode, responseBody);
  }

  // We need to read the response body to make sure the connection is closed
  await response.readBody();
}
