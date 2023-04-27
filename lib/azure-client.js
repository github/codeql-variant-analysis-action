"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadArtifact = void 0;
const core = __importStar(require("@actions/core"));
const form_data_1 = __importDefault(require("form-data"));
const api_client_1 = require("./api-client");
const http_error_1 = require("./http-error");
const retry_helper_1 = require("./retry-helper");
async function uploadArtifact(policy, artifactContents) {
    const maxAttempts = 3;
    const minSeconds = 10;
    const maxSeconds = 20;
    const retryHelper = new retry_helper_1.RetryHelper(maxAttempts, minSeconds, maxSeconds);
    return await retryHelper.execute(async () => {
        return await uploadArtifactImpl(policy, artifactContents);
    }, (err) => {
        if (err instanceof http_error_1.HTTPError && err.httpStatusCode) {
            // Only retry 504
            return err.httpStatusCode === 504;
        }
        // Otherwise abort
        return false;
    });
}
exports.uploadArtifact = uploadArtifact;
async function uploadArtifactImpl(policy, artifactContents) {
    const data = new form_data_1.default();
    for (const [key, value] of Object.entries(policy.form)) {
        data.append(key, value);
    }
    data.append("file", artifactContents, {
        contentType: "application/zip",
        filename: "results.zip",
    });
    const httpClient = (0, api_client_1.getApiClient)();
    const additionalHeaders = {
        ...policy.header,
        ...data.getHeaders(),
    };
    const response = await httpClient.sendStream("POST", policy.upload_url, data, additionalHeaders);
    if (!response.message.statusCode || response.message.statusCode > 299) {
        const responseBody = await response.readBody();
        core.warning(`Request to ${policy.upload_url} returned status code ${response.message.statusCode}: ${responseBody}`);
        throw new http_error_1.HTTPError(response.message.statusCode, responseBody);
    }
}
//# sourceMappingURL=azure-client.js.map