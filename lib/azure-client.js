"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadArtifact = void 0;
const fs = __importStar(require("fs"));
const form_data_1 = __importDefault(require("form-data"));
const gh_api_client_1 = require("./gh-api-client");
async function uploadArtifact(policy, artifactZipPath) {
    const data = new form_data_1.default();
    for (const [key, value] of policy.form.entries()) {
        data.append(key, value);
    }
    const artifactContents = fs.readFileSync(artifactZipPath, "utf8");
    data.append("file", artifactContents, {
        contentType: "application/zip",
        filename: "results.zip",
    });
    const httpClient = (0, gh_api_client_1.getApiClient)();
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