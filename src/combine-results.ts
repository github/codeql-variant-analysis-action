import fs from "fs";
import path from "path";

import { create as createArtifactClient } from "@actions/artifact";
import { getInput, warning, setFailed } from "@actions/core";
import { getExecOutput } from "@actions/exec";
import { context, getOctokit } from "@actions/github";
import { mkdirP, mv } from "@actions/io";

const formatBody = (
  query: string,
  results: string,
  errors: string
): string => `# Query
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

    // Stop if there are no artifacts
    if (downloadResponse.length === 0) {
      setFailed(
        "Unable to run query on any repositories. For more details, see the individual `run-query` jobs."
      );
      return;
    }

    // See if there are any "error" artifacts and if so, let the user know in the issue
    const errorArtifacts = downloadResponse.filter((artifact) =>
      artifact.artifactName.includes("error")
    );
    let errorsMd = "";
    if (errorArtifacts.length > 0) {
      errorsMd =
        "\n\nFailed to run query on some repositories. For more details, see the logs.";
    }

    // Result artifacts are the non-error artifacts
    const resultArtifacts = downloadResponse.filter(
      (artifact) => !errorArtifacts.includes(artifact)
    );

    await mkdirP("results");

    const octokit = getOctokit(token);
    const title = `Query run by ${context.actor} against ${resultArtifacts.length} \`${language}\` repositories`;
    const issue = await octokit.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title,
    });

    const csvs: string[] = [];
    const resultsMd = await Promise.all(
      resultArtifacts.map(async function (response) {
        const csv = path.join(response.downloadPath, "results.csv");
        const csvDest = path.join("results", response.artifactName);
        await mv(csv, csvDest);
        csvs.push(csvDest);

        const repoName = fs.readFileSync(
          path.join(response.downloadPath, "nwo.txt"),
          "utf-8"
        );
        const output = await getExecOutput("wc", ["-l", csvDest]); // TODO: preferably we would do this during results interpretation
        const results = parseInt(output.stdout.trim(), 10) - 1;

        if (results > 0) {
          const md = path.join(response.downloadPath, "results.md");
          const comment = await octokit.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: issue.data.number,
            body: fs.readFileSync(md, "utf8"),
          });
          return `| ${repoName} | [${results} result(s)](${comment.data.html_url}) |`;
        }
        return `| ${repoName} | _No results_ |`;
      })
    );

    const body = formatBody(query, resultsMd.join("\n"), errorsMd);

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
  } catch (error: any) {
    setFailed(error.message);
  }
}

void run();
