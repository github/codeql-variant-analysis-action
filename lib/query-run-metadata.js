"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readQueryRunMetadataFromFile = exports.writeQueryRunMetadataToFile = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Writes the metadata for a query run to a given file.
 */
function writeQueryRunMetadataToFile(metadataFilePath, nwo, resultCount, sha) {
    const queryRunMetadata = {
        nwo,
        resultCount,
        sha,
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
    try {
        const metadata = fs_1.default.readFileSync(path_1.default.join(downloadPath, "metadata.json"), "utf8");
        const metadataJson = JSON.parse(metadata);
        if (!metadataJson.nwo) {
            console.log(`metadata.json is missing nwo property.`);
        }
        else {
            return metadataJson;
        }
    }
    catch (error) {
        console.log(`Failed to parse metadata.json: ${error}`);
    }
    throw new Error("Unable to read metadata from artifact");
}
exports.readQueryRunMetadataFromFile = readQueryRunMetadataFromFile;
//# sourceMappingURL=query-run-metadata.js.map