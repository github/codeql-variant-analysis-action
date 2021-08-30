import fs from "fs";
import path from "path";

import artifact from "@actions/artifact";
import core from "@actions/core";
import exec from "@actions/exec";
import github from "@actions/github";
import io from "@actions/io";

const formatBody = (query: string) => `# Query
<details>
  <summary>Click to expand</summary>

\`\`\`ql
${query}
\`\`\`
</details>

# Results

|Repository|Results|
|---|---|
`;

async function run(): Promise<void> {
  try {
    const query = core.getInput("query", { required: true });
    const language = core.getInput("language", { required: true });
    const token = core.getInput("token", { required: true });

    await io.mkdirP("artifacts");
    const artifactClient = artifact.create();
    const downloadResponse = await artifactClient.downloadAllArtifacts(
      "artifacts"
    );

    await io.mkdirP("results");

    const context = github.context;
    const octokit = github.getOctokit(token);
    const title = `Query run by ${context.actor} against ${downloadResponse.length} \`${language}\` repositories`;
    const issue = await octokit.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title,
    });

    let body = formatBody(query);

    const csvs: string[] = [];
    for (const response of downloadResponse) {
      const csv = path.join(response.downloadPath, "results.csv");
      const csvDest = path.join("results", response.artifactName);
      await io.mv(csv, csvDest);
      csvs.push(csvDest);

      const md = path.join(response.downloadPath, "results.md");
      const comment = await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issue.data.number,
        body: fs.readFileSync(md, "utf8"),
      });

      const repoName = response.artifactName.replace("#", "/");
      const output = await exec.getExecOutput("wc", ["-l", csvDest]); // TODO: preferably we would do this during results interpretation
      const results = parseInt(output.stdout.trim()) - 2;
      if (results > 0) {
        body += `| ${repoName} | [${results} result(s)](${comment.data.html_url}) |\n`;
      } else {
        body += `| ${repoName} | _No results_ |\n`;
      }
    }

    await octokit.rest.issues.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issue.data.number,
      body,
    });

    await artifactClient.uploadArtifact(
      "all-results", // name
      csvs, // files
      "results", // rootdirectory
      { continueOnError: false }
    );

    core.warning(`Results now available at ${issue.data.html_url}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

void run();
