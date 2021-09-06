import fs from "fs";
import path from "path";

import { create as createArtifactClient } from "@actions/artifact";
import { getInput, warning, setFailed } from "@actions/core";
import { getExecOutput } from "@actions/exec";
import { context, getOctokit } from "@actions/github";
import { mkdirP, mv } from "@actions/io";

const formatBody = (query: string, results: string): string => `# Query
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

async function run(): Promise<void> {
  try {
    const query = getInput("query", { required: true });
    const language = getInput("language", { required: true });
    const token = getInput("token", { required: true });

    await mkdirP("artifacts");
    const artifactClient = createArtifactClient();
    const downloadResponse = await artifactClient.downloadAllArtifacts(
      "artifacts"
    );

    await mkdirP("results");

    const octokit = getOctokit(token);
    const title = `Query run by ${context.actor} against ${downloadResponse.length} \`${language}\` repositories`;
    const issue = await octokit.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title,
    });

    const csvs: string[] = [];
    const resultsMd = await Promise.all(
      downloadResponse.map(async function (response) {
        const csv = path.join(response.downloadPath, "results.csv");
        const csvDest = path.join("results", response.artifactName);
        await mv(csv, csvDest);
        csvs.push(csvDest);

        const md = path.join(response.downloadPath, "results.md");
        const comment = await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: issue.data.number,
          body: fs.readFileSync(md, "utf8"),
        });

        const repoName = fs.readFileSync(
          path.join(response.downloadPath, "nwo.txt"),
          "utf-8"
        );
        const output = await getExecOutput("wc", ["-l", csvDest]); // TODO: preferably we would do this during results interpretation
        const results = parseInt(output.stdout.trim()) - 2;
        if (results > 0) {
          return `| ${repoName} | [${results} result(s)](${comment.data.html_url}) |`;
        }
        return `| ${repoName} | _No results_ |`;
      })
    );

    const body = formatBody(query, resultsMd.join("\n"));

    void Promise.all([
      octokit.rest.issues.update({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issue.data.number,
        body,
      }),
      artifactClient.uploadArtifact(
        "all-results", // name
        csvs, // files
        "results", // rootdirectory
        { continueOnError: false }
      ),
    ]);

    warning(`Results now available at ${issue.data.html_url}`);
  } catch (error) {
    setFailed(error.message);
  }
}

void run();
