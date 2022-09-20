"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadArtifact = void 0;
const form_data_1 = __importDefault(require("form-data"));
const download_1 = require("./download");
async function uploadArtifact(policy, artifactContents) {
    const data = new form_data_1.default();
    for (const [key, value] of Object.entries(policy.form)) {
        data.append(key, value);
    }
    data.append("file", artifactContents, {
        contentType: "application/zip",
        filename: "results.zip",
    });
    const httpClient = (0, download_1.getApiClient)();
    const additionalHeaders = {
        ...policy.header,
        ...data.getHeaders(),
    };
    const response = await httpClient.sendStream("POST", policy.upload_url, data, additionalHeaders);
    if (!response.message.statusCode || response.message.statusCode > 299) {
        const responseBody = await response.readBody();
        console.log(`Request to ${policy.upload_url} returned status code ${response.message.statusCode}: ${responseBody}`);
        throw new Error(`Failed to upload artifact. Status code: ${response.message.statusCode}).`);
    }
}
exports.uploadArtifact = uploadArtifact;
//# sourceMappingURL=azure-client.js.map