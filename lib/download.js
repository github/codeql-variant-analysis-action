"use strict";
// This file borrows heavily from the actions "downloadTool" function:
// https://github.com/actions/toolkit/blob/27f76dfe1afb2b7e5e679cd8e97192d34d8320e6/packages/tool-cache/src/tool-cache.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
exports.download = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const stream = __importStar(require("stream"));
const util = __importStar(require("util"));
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
const api_client_1 = require("./api-client");
const http_error_1 = require("./http-error");
const retry_helper_1 = require("./retry-helper");
/**
 * Download a file from an url and stream it into a local file
 *
 * @param url       url of file to download
 * @param dest      path to download file
 * @param auth      authorization header
 * @returns         path to downloaded file
 */
async function download(url, dest, auth, accept) {
    await io.mkdirP(path.dirname(dest));
    core.debug(`Downloading ${url}`);
    core.debug(`Destination ${dest}`);
    const maxAttempts = 3;
    const minSeconds = 10;
    const maxSeconds = 20;
    const retryHelper = new retry_helper_1.RetryHelper(maxAttempts, minSeconds, maxSeconds);
    return await retryHelper.execute(async () => {
        return await downloadAttempt(url, dest, auth, accept);
    }, (err) => {
        if (err instanceof http_error_1.HTTPError && err.httpStatusCode) {
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
async function downloadAttempt(url, dest, auth, accept) {
    if (fs.existsSync(dest)) {
        throw new Error(`Destination file path ${dest} already exists`);
    }
    // Get the response headers
    const http = (0, api_client_1.getApiClient)();
    const headers = {};
    if (auth) {
        core.debug("set auth");
        headers.authorization = auth;
    }
    if (accept) {
        headers.accept = accept;
    }
    const response = await http.get(url, headers);
    if (response.message.statusCode !== 200) {
        const err = new http_error_1.HTTPError(response.message.statusCode, await response.readBody());
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
                core.debug(`Failed to delete '${dest}'. ${err instanceof Error ? err.message : err}`);
            }
        }
    }
}
//# sourceMappingURL=download.js.map