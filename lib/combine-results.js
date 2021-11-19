"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const artifact_1 = require("@actions/artifact");
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const io_1 = require("@actions/io");
const tool_cache_1 = require("@actions/tool-cache");
const download_1 = require("./download");
const interpret_1 = require("./interpret");
const formatBody = (query, results, errors) => `# Query
<details>
  <summary>Click to expand</summary>

\`\`\`ql
${query}
\`\`\`
</details>

${results}
${errors}`;
async function run() {
    try {
        const query = (0, core_1.getInput)("query") || undefined;
        const queryPackUrl = (0, core_1.getInput)("query_pack_url") || undefined;
        if ((query === undefined) === (queryPackUrl === undefined)) {
            (0, core_1.setFailed)("Exactly one of 'query' and 'query_pack_url' is required");
            return;
        }
        const language = (0, core_1.getInput)("language", { required: true });
        const token = (0, core_1.getInput)("token", { required: true });
        let queryText;
        if (queryPackUrl !== undefined) {
            console.log("Getting query pack");
            const queryPackArchive = await (0, download_1.download)(queryPackUrl, "query_pack.tar.gz");
            const queryPack = await (0, tool_cache_1.extractTar)(queryPackArchive);
            queryText = fs_1.default.readFileSync(path_1.default.join(queryPack, "query.ql"), "utf-8");
        }
        else {
            queryText = query; // Must be defined if queryPackUrl isn't
        }
        await (0, io_1.mkdirP)("artifacts");
        const artifactClient = (0, artifact_1.create)();
        const downloadResponse = await artifactClient.downloadAllArtifacts("artifacts");
        // See if there are any "error" artifacts and if so, let the user know in the issue
        const errorArtifacts = downloadResponse.filter((artifact) => artifact.artifactName.includes("error"));
        let errorsMd = "";
        if (errorArtifacts.length > 0) {
            const workflowRunUrl = `${process.env["GITHUB_SERVER_URL"]}/${process.env["GITHUB_REPOSITORY"]}/actions/runs/${process.env["GITHUB_RUN_ID"]}`;
            errorsMd = `\n\nNote: The query failed to run on some repositories. For more details, see the [logs](${workflowRunUrl}).`;
        }
        // Result artifacts are the non-error artifacts
        const resultArtifacts = downloadResponse.filter((artifact) => !errorArtifacts.includes(artifact));
        // Stop if there are no result artifacts
        if (resultArtifacts.length === 0) {
            (0, core_1.setFailed)("Unable to run query on any repositories. For more details, see the individual `run-query` jobs.");
            return;
        }
        await (0, io_1.mkdirP)("results");
        const octokit = (0, github_1.getOctokit)(token);
        const title = `Query run by ${github_1.context.actor} against ${resultArtifacts.length} \`${language}\` repositories`;
        const issue = await octokit.rest.issues.create({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            title,
        });
        const csvs = await Promise.all(resultArtifacts.map(async function (response) {
            const csv = path_1.default.join(response.downloadPath, "results.csv");
            const csvDest = path_1.default.join("results", response.artifactName);
            await (0, io_1.mv)(csv, csvDest);
            return csvDest;
        }));
        const resultsMd = await (0, interpret_1.createResultsMd)(octokit, issue.data.number, resultArtifacts);
        const resultsIndex = await (0, interpret_1.createResultIndex)(resultArtifacts);
        // Create the index.json file
        const resultIndexFile = path_1.default.join("results", "index.json");
        fs_1.default.writeFileSync(resultIndexFile, JSON.stringify(resultsIndex, null, 2));
        const body = formatBody(queryText, resultsMd, errorsMd);
        void Promise.all([
            octokit.rest.issues.update({
                owner: github_1.context.repo.owner,
                repo: github_1.context.repo.repo,
                issue_number: issue.data.number,
                body,
            }),
            artifactClient.uploadArtifact("all-results", // name
            csvs, // files
            "results", // rootdirectory
            { continueOnError: false }),
            artifactClient.uploadArtifact("result-index", // name
            [resultIndexFile], // files
            "results", // rootdirectory
            { continueOnError: false }),
        ]);
        (0, core_1.notice)(`Results now available at ${issue.data.html_url}`);
    }
    catch (error) {
        (0, core_1.setFailed)(error.message);
    }
}
void run();
//# sourceMappingURL=combine-results.js.map