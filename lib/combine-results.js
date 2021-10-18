"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const artifact_1 = require("@actions/artifact");
const core_1 = require("@actions/core");
const exec_1 = require("@actions/exec");
const github_1 = require("@actions/github");
const io_1 = require("@actions/io");
const formatBody = (query, results, errors) => `# Query
<details>
  <summary>Click to expand</summary>

\`\`\`ql
${query}
\`\`\`
</details>

# Results

|Repository|Results|
|---|---|
${results}
${errors}`;
async function run() {
    try {
        const query = (0, core_1.getInput)("query", { required: true });
        const language = (0, core_1.getInput)("language", { required: true });
        const token = (0, core_1.getInput)("token", { required: true });
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
        const csvs = [];
        const resultsMd = await Promise.all(resultArtifacts.map(async function (response) {
            const csv = path_1.default.join(response.downloadPath, "results.csv");
            const csvDest = path_1.default.join("results", response.artifactName);
            await (0, io_1.mv)(csv, csvDest);
            csvs.push(csvDest);
            const repoName = fs_1.default.readFileSync(path_1.default.join(response.downloadPath, "nwo.txt"), "utf-8");
            const output = await (0, exec_1.getExecOutput)("wc", ["-l", csvDest]); // TODO: preferably we would do this during results interpretation
            const results = parseInt(output.stdout.trim(), 10) - 1;
            if (results > 0) {
                const md = path_1.default.join(response.downloadPath, "results.md");
                const comment = await octokit.rest.issues.createComment({
                    owner: github_1.context.repo.owner,
                    repo: github_1.context.repo.repo,
                    issue_number: issue.data.number,
                    body: fs_1.default.readFileSync(md, "utf8"),
                });
                return `| ${repoName} | [${results} result(s)](${comment.data.html_url}) |`;
            }
            return `| ${repoName} | _No results_ |`;
        }));
        const body = formatBody(query, resultsMd.join("\n"), errorsMd);
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
        ]);
        (0, core_1.notice)(`Results now available at ${issue.data.html_url}`);
    }
    catch (error) {
        (0, core_1.setFailed)(error.message);
    }
}
void run();
//# sourceMappingURL=combine-results.js.map