import FormData from "form-data";

import { getApiClient } from "./download";
import { Policy } from "./gh-api-client";

export async function uploadArtifact(policy: Policy, artifactContents: Buffer) {
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
    additionalHeaders
  );

  if (!response.message.statusCode || response.message.statusCode > 299) {
    const responseBody = await response.readBody();
    console.log(
      `Request to ${policy.upload_url} returned status code ${response.message.statusCode}: ${responseBody}`
    );
    throw new Error(
      `Failed to upload artifact. Status code: ${response.message.statusCode}).`
    );
  }
}
