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
const codeql_1 = require("./codeql");
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
        const language = (0, core_1.getInput)("language", { required: true });
        const token = (0, core_1.getInput)("token", { required: true });
        const codeql = (0, core_1.getInput)("codeql", { required: true });
        const queryText = await getQueryText(codeql);
        const artifactClient = (0, artifact_1.create)();
        const [resultArtifacts, errorArtifacts] = await downloadArtifacts(artifactClient);
        // Fail if there are no result artifacts
        if (resultArtifacts.length === 0) {
            (0, core_1.setFailed)("Unable to run query on any repositories.");
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
        await Promise.all([
            uploadResultIndex(resultArtifacts, artifactClient),
            updateIssueBody(octokit, issue.data.number, queryText, resultArtifacts, errorArtifacts),
        ]);
        (0, core_1.notice)(`Results now available at ${issue.data.html_url}`);
    }
    catch (error) {
        (0, core_1.setFailed)(error.message);
    }
}
async function getQueryText(codeql) {
    const queryPackUrl = (0, core_1.getInput)("query_pack_url", { required: true });
    console.log("Getting query pack");
    const queryPackArchive = await (0, download_1.download)(queryPackUrl, "query_pack.tar.gz");
    const queryPack = await (0, tool_cache_1.extractTar)(queryPackArchive);
    const queryFile = await (0, codeql_1.getRemoteQueryPackDefaultQuery)(codeql, queryPack);
    if (queryFile === undefined) {
        return "Unable to display executed query";
    }
    else {
        return await fs_1.default.promises.readFile(queryFile, "utf8");
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
async function uploadResultIndex(resultArtifacts, artifactClient) {
    const resultsIndex = await (0, interpret_1.createResultIndex)(resultArtifacts);
    // Create the index.json file
    const resultIndexFile = path_1.default.join("results", "index.json");
    await fs_1.default.promises.writeFile(resultIndexFile, JSON.stringify(resultsIndex, null, 2));
    await artifactClient.uploadArtifact("result-index", // name
    [resultIndexFile], // files
    "results", // rootdirectory
    { continueOnError: false });
}
async function updateIssueBody(octokit, issueNumber, queryText, resultArtifacts, errorArtifacts) {
    const resultsMd = await (0, interpret_1.createResultsMd)(octokit, issueNumber, resultArtifacts);
    let errorsMd = "";
    if (errorArtifacts.length > 0) {
        const workflowRunUrl = `${process.env["GITHUB_SERVER_URL"]}/${process.env["GITHUB_REPOSITORY"]}/actions/runs/${process.env["GITHUB_RUN_ID"]}`;
        errorsMd = `\n\nNote: The query failed to run on some repositories. For more details, see the [logs](${workflowRunUrl}).`;
    }
    const body = formatBody(queryText, resultsMd, errorsMd);
    await octokit.rest.issues.update({
        owner: github_1.context.repo.owner,
        repo: github_1.context.repo.repo,
        issue_number: issueNumber,
        body,
    });
}
void run();
//# sourceMappingURL=combine-results.js.map