import * as httpm from "@actions/http-client";

import { userAgent } from "./gh-api-client";

export function getApiClient(): httpm.HttpClient {
  return new httpm.HttpClient(userAgent, [], {
    allowRetries: true,
  });
}
