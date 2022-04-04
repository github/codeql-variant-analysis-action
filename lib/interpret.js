"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResultIndex = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function createResultIndex(successArtifacts, failureArtifacts) {
    const successes = successArtifacts.map(function (response) {
        const nwo = fs_1.default.readFileSync(path_1.default.join(response.downloadPath, "nwo.txt"), "utf-8");
        const id = response.artifactName;
        let sha = undefined;
        const shaPath = path_1.default.join(response.downloadPath, "sha.txt");
        try {
            sha = fs_1.default.readFileSync(shaPath, "utf-8");
        }
        catch (err) {
            console.log(`Couldn't read sha.txt from ${response.downloadPath}: ${err}`);
        }
        const results_count = parseInt(fs_1.default.readFileSync(path_1.default.join(response.downloadPath, "resultcount.txt"), "utf-8"), 10);
        const bqrs_file_size = fs_1.default.statSync(path_1.default.join(response.downloadPath, "results.bqrs")).size;
        let sarif_file_size = undefined;
        if (fs_1.default.existsSync(path_1.default.join(response.downloadPath, "results.sarif"))) {
            sarif_file_size = fs_1.default.statSync(path_1.default.join(response.downloadPath, "results.sarif")).size;
        }
        const successIndexItem = {
            nwo,
            id,
            sha,
            results_count,
            bqrs_file_size,
            sarif_file_size,
        };
        return successIndexItem;
    });
    const failures = failureArtifacts.map(function (response) {
        const nwo = fs_1.default.readFileSync(path_1.default.join(response.downloadPath, "nwo.txt"), "utf-8");
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