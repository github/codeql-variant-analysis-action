"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readQueryRunMetadataFromFile = exports.writeQueryRunMetadataToFile = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const json_validation_1 = require("./json-validation");
/**
 * Writes the metadata for a query run to a given file.
 */
function writeQueryRunMetadataToFile(metadataFilePath, nwo, resultCount, sha, sourceLocationPrefix) {
    const queryRunMetadata = {
        nwo,
        resultCount,
        sha,
        sourceLocationPrefix,
    };
    fs_1.default.writeFileSync(metadataFilePath, JSON.stringify(queryRunMetadata));
    return;
}
exports.writeQueryRunMetadataToFile = writeQueryRunMetadataToFile;
/**
 * Parses the metadata for a query run from a given file and returns it
 * as a `QueryRunMetadata` object.
 */
function readQueryRunMetadataFromFile(downloadPath) {
    const metadataPath = path_1.default.join(downloadPath, "metadata.json");
    const metadata = (0, json_validation_1.validateObject)(JSON.parse(fs_1.default.readFileSync(metadataPath, "utf8")), "queryRunMetadata");
    return metadata;
}
exports.readQueryRunMetadataFromFile = readQueryRunMetadataFromFile;
//# sourceMappingURL=query-run-metadata.js.map