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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const artifact = __importStar(require("@actions/artifact"));
const core = __importStar(require("@actions/core"));
const lib_1 = require("./lib");
async function run() {
    try {
        const query = core.getInput("query", { required: true });
        const language = core.getInput("language", { required: true });
        const nwo = core.getInput("repository", { required: true });
        const token = core.getInput("token", { required: true });
        const codeql = core.getInput("codeql", { required: true });
        core.setSecret(token);
        // 1. Use the GitHub API to download the database using token
        const dbZip = await lib_1.downloadDatabase(token, nwo, language);
        await lib_1.unbundleDatabase(dbZip);
        // 2. Run the query
        await lib_1.runQuery(codeql, language, "database", query, nwo);
        // 3. Upload the results as an artifact
        const artifactClient = artifact.create();
        await artifactClient.uploadArtifact(nwo.replace("/", "#"), // name
        ["results/results.bqrs", "results/results.csv", "results/results.md"], // files
        "results", // rootdirectory
        { continueOnError: false, retentionDays: 1 });
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
void run();
//# sourceMappingURL=query.js.map