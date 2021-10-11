// This file borrows heavily from the actions "downloadTool" function:
// https://github.com/actions/toolkit/blob/main/packages/tool-cache/src/tool-cache.ts#L38

import * as fs from "fs";
import * as path from "path";
import * as stream from "stream";
import * as util from "util";

import * as core from "@actions/core";
import * as httpm from "@actions/http-client";
import { IHeaders } from "@actions/http-client/interfaces";
import * as io from "@actions/io";

export class HTTPError extends Error {
  httpStatusCode: number | undefined;
  httpMessage: string;
  constructor(httpStatusCode: number | undefined, httpMessage: string) {
    super(`Unexpected HTTP response: ${httpStatusCode}. ${httpMessage}`);
    // Set status code and error message to `this`
    this.httpStatusCode = httpStatusCode;
    this.httpMessage = httpMessage;
  }
}

const userAgent = "actions/tool-cache";

/**
 * Download a database from an url and stream it into a file
 *
 * @param url       url of database to download
 * @param dest      path to download database
 * @param auth      authorization header
 * @param headers   other headers
 * @returns         path to downloaded database
 */
export async function downloadDatabaseFile(
  url: string,
  dest: string,
  auth?: string
): Promise<string> {
  await io.mkdirP(path.dirname(dest));
  core.debug(`Downloading ${url}`);
  core.debug(`Destination ${dest}`);

  const maxAttempts = 3;
  const minSeconds = 10;
  const maxSeconds = 20;
  const retryHelper = new RetryHelper(maxAttempts, minSeconds, maxSeconds);
  return await retryHelper.execute(
    async () => {
      return await downloadDatabaseFileAttempt(url, dest || "", auth);
    },
    (err: Error) => {
      if (err instanceof HTTPError && err.httpStatusCode) {
        // Don't retry anything less than 500, except 408 Request Timeout and 429 Too Many Requests
        if (
          err.httpStatusCode < 500 &&
          err.httpStatusCode !== 408 &&
          err.httpStatusCode !== 429
        ) {
          return false;
        }
      }

      // Otherwise retry
      return true;
    }
  );
}

async function downloadDatabaseFileAttempt(
  url: string,
  dest: string,
  auth?: string
): Promise<string> {
  if (fs.existsSync(dest)) {
    throw new Error(`Destination file path ${dest} already exists`);
  }

  // Get the response headers
  const http = new httpm.HttpClient(userAgent, [], {
    allowRetries: false,
  });

  const headers: IHeaders = {};
  if (auth) {
    core.debug("set auth");
    headers.authorization = auth;
  }

  const response: httpm.HttpClientResponse = await http.get(url, headers);

  if (response.message.statusCode !== 200) {
    const err = new HTTPError(
      response.message.statusCode,
      await response.readBody()
    );
    core.debug(
      `Failed to download from "${url}". Code(${err.httpStatusCode}) Message(${err.httpMessage})`
    );
    throw err;
  }

  // Download the response body
  const pipeline = util.promisify(stream.pipeline);
  let succeeded = false;
  try {
    await pipeline(response.message, fs.createWriteStream(dest));
    core.debug("download complete");
    succeeded = true;
    return dest;
  } finally {
    // Error, delete dest before retry
    if (!succeeded) {
      core.debug("download failed");
      try {
        await io.rmRF(dest);
      } catch (err: any) {
        core.debug(`Failed to delete '${dest}'. ${err.message}`);
      }
    }
  }
}

/**
 * Internal class for retries.
 * Borrowed from https://github.com/actions/toolkit/blob/main/packages/tool-cache/src/retry-helper.ts.
 */
class RetryHelper {
  private maxAttempts: number;
  private minSeconds: number;
  private maxSeconds: number;

  constructor(maxAttempts: number, minSeconds: number, maxSeconds: number) {
    if (maxAttempts < 1) {
      throw new Error("max attempts should be greater than or equal to 1");
    }

    this.maxAttempts = maxAttempts;
    this.minSeconds = Math.floor(minSeconds);
    this.maxSeconds = Math.floor(maxSeconds);
    if (this.minSeconds > this.maxSeconds) {
      throw new Error(
        "min seconds should be less than or equal to max seconds"
      );
    }
  }

  async execute<T>(
    action: () => Promise<T>,
    isRetryable?: (e: Error) => boolean
  ): Promise<T> {
    let attempt = 1;
    while (attempt < this.maxAttempts) {
      // Try
      try {
        return await action();
      } catch (err: any) {
        if (isRetryable && !isRetryable(err)) {
          throw err;
        }

        core.info(err.message);
      }

      // Sleep
      const seconds = this.getSleepAmount();
      core.info(`Waiting ${seconds} seconds before trying again`);
      await this.sleep(seconds);
      attempt++;
    }

    // Last attempt
    return await action();
  }

  private getSleepAmount(): number {
    return (
      Math.floor(Math.random() * (this.maxSeconds - this.minSeconds + 1)) +
      this.minSeconds
    );
  }

  private async sleep(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
