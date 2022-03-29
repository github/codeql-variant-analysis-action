"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const artifact_1 = require("@actions/artifact");
const core_1 = require("@actions/core");
const io_1 = require("@actions/io");
const interpret_1 = require("./interpret");
async function run() {
    try {
        const artifactClient = (0, artifact_1.create)();
        const [resultArtifacts, errorArtifacts] = await downloadArtifacts(artifactClient);
        // Fail if there are no result artifacts
        if (resultArtifacts.length === 0) {
            (0, core_1.setFailed)("Unable to run query on any repositories.");
            return;
        }
        await (0, io_1.mkdirP)("results");
        await uploadResultIndex(resultArtifacts, errorArtifacts, artifactClient);
    }
    catch (error) {
        (0, core_1.setFailed)(error.message);
    }
}
async function downloadArtifacts(artifactClient) {
    await (0, io_1.mkdirP)("artifacts");
    const downloadResponse = await artifactClient.downloadAllArtifacts("artifacts");
    // See if there are any "error" artifacts and if so, let the user know in the issue
    const errorArtifacts = downloadResponse.filter((artifact) => artifact.artifactName.includes("error"));
    // Result artifacts are the non-error artifacts
    const resultArtifacts = downloadResponse.filter((artifact) => !errorArtifacts.includes(artifact));
    return [resultArtifacts, errorArtifacts];
}
async function uploadResultIndex(resultArtifacts, errorArtifacts, artifactClient) {
    const resultsIndex = (0, interpret_1.createResultIndex)(resultArtifacts, errorArtifacts);
    // Create the index.json file
    const resultIndexFile = path_1.default.join("results", "index.json");
    await fs_1.default.promises.writeFile(resultIndexFile, JSON.stringify(resultsIndex, null, 2));
    await artifactClient.uploadArtifact("result-index", // name
    [resultIndexFile], // files
    "results", // rootdirectory
    { continueOnError: false });
}
void run();
//# sourceMappingURL=combine-results.js.map