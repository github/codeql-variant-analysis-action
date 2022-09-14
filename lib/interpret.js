"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResultIndex = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const query_run_metadata_1 = require("./query-run-metadata");
function createResultIndex(successArtifacts, failureArtifacts) {
    const successes = successArtifacts.map(function (response) {
        console.log(`Reading metadata from artifact: ${response.artifactName}`);
        const metadata = (0, query_run_metadata_1.readQueryRunMetadataFromFile)(response.downloadPath);
        if (metadata.resultCount === undefined || metadata.resultCount === null) {
            throw new Error(`metadata.json is missing resultCount property.`);
        }
        if (!metadata.sourceLocationPrefix) {
            throw new Error(`metadata.json is missing sourceLocationPrefix property.`);
        }
        const id = response.artifactName;
        const bqrs_file_size = fs_1.default.statSync(path_1.default.join(response.downloadPath, "results.bqrs")).size;
        let sarif_file_size = undefined;
        if (fs_1.default.existsSync(path_1.default.join(response.downloadPath, "results.sarif"))) {
            sarif_file_size = fs_1.default.statSync(path_1.default.join(response.downloadPath, "results.sarif")).size;
        }
        /* eslint-disable @typescript-eslint/naming-convention */
        const successIndexItem = {
            nwo: metadata.nwo,
            id,
            sha: metadata.sha,
            results_count: metadata.resultCount,
            bqrs_file_size,
            sarif_file_size,
            source_location_prefix: metadata.sourceLocationPrefix,
        };
        /* eslint-enable @typescript-eslint/naming-convention */
        return successIndexItem;
    });
    const failures = failureArtifacts.map(function (response) {
        console.log(`Reading metadata from artifact: ${response.artifactName}`);
        const metadata = (0, query_run_metadata_1.readQueryRunMetadataFromFile)(response.downloadPath);
        const nwo = metadata.nwo;
        // id is the artifactName without the "-error" suffix
        const id = response.artifactName.substring(0, response.artifactName.length - 6);
        const error = fs_1.default.readFileSync(path_1.default.join(response.downloadPath, "error.txt"), "utf-8");
        const failureIndexItem = {
            nwo,
            id,
            error,
        };
        return failureIndexItem;
    });
    return {
        successes,
        failures,
    };
}
exports.createResultIndex = createResultIndex;
//# sourceMappingURL=interpret.js.map