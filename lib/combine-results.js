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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const artifact = __importStar(require("@actions/artifact"));
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const github = __importStar(require("@actions/github"));
const io = __importStar(require("@actions/io"));
async function run() {
    try {
        const query = core.getInput("query", { required: true });
        const language = core.getInput("language", { required: true });
        await io.mkdirP("artifacts");
        const artifactClient = artifact.create();
        const downloadResponse = await artifactClient.downloadAllArtifacts("artifacts");
        await io.mkdirP("results");
        const context = github.context;
        core.debug(`context: ${JSON.stringify(context)}`);
        core.debug(`env: ${JSON.stringify(process.env)}`);
        const octokit = github.getOctokit(process.env.GITHUB_TOKEN || "");
        const title = `Query run by ${context.actor} against ${downloadResponse.length} \`${language}\` repositories`;
        const issue = await octokit.rest.issues.create({
            owner: context.repo.owner,
            repo: context.repo.repo,
            title,
        });
        let body = `# Query
    <details>
      <summary>Click to expand</summary>

    \`\`\`ql
    ${query}
    \`\`\`
    </details>

    # Results

    |Repository|Results|
    |---|---|`;
        const csvs = [];
        for (const response of downloadResponse) {
            const csv = path_1.default.join(response.downloadPath, "results.csv");
            const csvDest = path_1.default.join("results", response.artifactName);
            await io.mv(csv, csvDest);
            csvs.push(csvDest);
            const md = path_1.default.join(response.downloadPath, "results.md");
            const comment = await octokit.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: issue.data.number,
                body: fs_1.default.readFileSync(md, "utf8"),
            });
            const repoName = response.artifactName.replace("#", "/");
            const output = await exec.getExecOutput("wc", ["-l", csvDest]); // TODO: preferably we would do this during results interpretation
            const results = parseInt(output.stdout.trim()) - 2;
            if (results > 0) {
                body += `| ${repoName} | [${results} result(s)](${comment.data.html_url}) |\n`;
            }
            else {
                body += `| ${repoName} | _No results_ |\n`;
            }
        }
        await octokit.rest.issues.update({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: issue.data.number,
            body,
        });
        await artifactClient.uploadArtifact("all-results", // name
        csvs, // files
        "results", // rootdirectory
        { continueOnError: false });
        core.warning(`Results now available at ${issue.data.html_url}`);
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
void run();
//# sourceMappingURL=combine-results.js.map