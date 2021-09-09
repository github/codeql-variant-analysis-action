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
const formatBody = (query, results) => `# Query
<details>
  <summary>Click to expand</summary>

\`\`\`ql
${query}
\`\`\`
</details>

# Results

|Repository|Results|
|---|---|
${results}`;
async function run() {
    try {
        const query = core_1.getInput("query", { required: true });
        const language = core_1.getInput("language", { required: true });
        const token = core_1.getInput("token", { required: true });
        await io_1.mkdirP("artifacts");
        const artifactClient = artifact_1.create();
        const downloadResponse = await artifactClient.downloadAllArtifacts("artifacts");
        await io_1.mkdirP("results");
        const octokit = github_1.getOctokit(token);
        const title = `Query run by ${github_1.context.actor} against ${downloadResponse.length} \`${language}\` repositories`;
        const issue = await octokit.rest.issues.create({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            title,
        });
        const csvs = [];
        const resultsMd = await Promise.all(downloadResponse.map(async function (response) {
            const csv = path_1.default.join(response.downloadPath, "results.csv");
            const csvDest = path_1.default.join("results", response.artifactName);
            await io_1.mv(csv, csvDest);
            csvs.push(csvDest);
            const md = path_1.default.join(response.downloadPath, "results.md");
            const comment = await octokit.rest.issues.createComment({
                owner: github_1.context.repo.owner,
                repo: github_1.context.repo.repo,
                issue_number: issue.data.number,
                body: fs_1.default.readFileSync(md, "utf8"),
            });
            const repoName = fs_1.default.readFileSync(path_1.default.join(response.downloadPath, "nwo.txt"), "utf-8");
            const output = await exec_1.getExecOutput("wc", ["-l", csvDest]); // TODO: preferably we would do this during results interpretation
            const results = parseInt(output.stdout.trim()) - 2;
            if (results > 0) {
                return `| ${repoName} | [${results} result(s)](${comment.data.html_url}) |`;
            }
            return `| ${repoName} | _No results_ |`;
        }));
        const body = formatBody(query, resultsMd.join("\n"));
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
        core_1.warning(`Results now available at ${issue.data.html_url}`);
    }
    catch (error) {
        core_1.setFailed(error.message);
    }
}
void run();
//# sourceMappingURL=combine-results.js.map