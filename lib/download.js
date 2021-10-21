"use strict";
// This file borrows heavily from the actions "downloadTool" function:
// https://github.com/actions/toolkit/blob/27f76dfe1afb2b7e5e679cd8e97192d34d8320e6/packages/tool-cache/src/tool-cache.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.download = exports.HTTPError = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const stream = __importStar(require("stream"));
const util = __importStar(require("util"));
const core = __importStar(require("@actions/core"));
const httpm = __importStar(require("@actions/http-client"));
const io = __importStar(require("@actions/io"));
class HTTPError extends Error {
    constructor(httpStatusCode, httpMessage) {
        super(`Unexpected HTTP response: ${httpStatusCode}. ${httpMessage}`);
        this.httpStatusCode = httpStatusCode;
        this.httpMessage = httpMessage;
    }
}
exports.HTTPError = HTTPError;
const userAgent = "GitHub remote queries";
/**
 * Download a file from an url and stream it into a local file
 *
 * @param url       url of file to download
 * @param dest      path to download file
 * @param auth      authorization header
 * @returns         path to downloaded file
 */
async function download(url, dest, auth) {
    await io.mkdirP(path.dirname(dest));
    core.debug(`Downloading ${url}`);
    core.debug(`Destination ${dest}`);
    const maxAttempts = 3;
    const minSeconds = 10;
    const maxSeconds = 20;
    const retryHelper = new RetryHelper(maxAttempts, minSeconds, maxSeconds);
    return await retryHelper.execute(async () => {
        return await downloadAttempt(url, dest, auth);
    }, (err) => {
        if (err instanceof HTTPError && err.httpStatusCode) {
            // Don't retry anything less than 500, except 408 Request Timeout and 429 Too Many Requests
            if (err.httpStatusCode < 500 &&
                err.httpStatusCode !== 408 &&
                err.httpStatusCode !== 429) {
                return false;
            }
        }
        // Otherwise retry
        return true;
    });
}
exports.download = download;
async function downloadAttempt(url, dest, auth) {
    if (fs.existsSync(dest)) {
        throw new Error(`Destination file path ${dest} already exists`);
    }
    // Get the response headers
    const http = new httpm.HttpClient(userAgent, [], {
        allowRetries: false,
    });
    const headers = {};
    if (auth) {
        core.debug("set auth");
        headers.authorization = auth;
    }
    const response = await http.get(url, headers);
    if (response.message.statusCode !== 200) {
        const err = new HTTPError(response.message.statusCode, await response.readBody());
        core.debug(`Failed to download from "${url}". Code(${err.httpStatusCode}) Message(${err.httpMessage})`);
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
    }
    finally {
        // Error, delete dest before retry
        if (!succeeded) {
            core.debug("download failed");
            try {
                await io.rmRF(dest);
            }
            catch (err) {
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
    constructor(maxAttempts, minSeconds, maxSeconds) {
        if (maxAttempts < 1) {
            throw new Error("max attempts should be greater than or equal to 1");
        }
        this.maxAttempts = maxAttempts;
        this.minSeconds = Math.floor(minSeconds);
        this.maxSeconds = Math.floor(maxSeconds);
        if (this.minSeconds > this.maxSeconds) {
            throw new Error("min seconds should be less than or equal to max seconds");
        }
    }
    async execute(action, isRetryable) {
        let attempt = 1;
        while (attempt < this.maxAttempts) {
            // Try
            try {
                return await action();
            }
            catch (err) {
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
    getSleepAmount() {
        return (Math.floor(Math.random() * (this.maxSeconds - this.minSeconds + 1)) +
            this.minSeconds);
    }
    async sleep(seconds) {
        return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }
}
//# sourceMappingURL=download.js.map