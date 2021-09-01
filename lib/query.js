"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const artifact_1 = require("@actions/artifact");
const core_1 = require("@actions/core");
const codeql_1 = require("./codeql");
async function run() {
    try {
        const query = core_1.getInput("query", { required: true });
        const language = core_1.getInput("language", { required: true });
        const nwo = core_1.getInput("repository", { required: true });
        const token = core_1.getInput("token", { required: true });
        const codeql = core_1.getInput("codeql", { required: true });
        core_1.setSecret(token);
        // 1. Use the GitHub API to download the database using token
        const dbZip = await codeql_1.downloadDatabase(token, nwo, language);
        // 2. Run the query
        await codeql_1.runQuery(codeql, language, dbZip, query, nwo);
        // 3. Upload the results as an artifact
        const artifactClient = artifact_1.create();
        await artifactClient.uploadArtifact(nwo.replace("/", "#"), // name
        ["results/results.bqrs", "results/results.csv", "results/results.md"], // files
        "results", // rootdirectory
        { continueOnError: false, retentionDays: 1 });
    }
    catch (error) {
        core_1.setFailed(error.message);
    }
}
void run();
//# sourceMappingURL=query.js.map