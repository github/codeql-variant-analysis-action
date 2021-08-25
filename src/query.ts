import * as artifact from "@actions/artifact";
import * as core from "@actions/core";

import { downloadDatabase, unbundleDatabase, runQuery } from "./codeql";

async function run(): Promise<void> {
  try {
    const query = core.getInput("query", { required: true });
    const language = core.getInput("language", { required: true });
    const nwo = core.getInput("repository", { required: true });
    const token = core.getInput("token", { required: true });
    const codeql = core.getInput("codeql", { required: true });

    core.setSecret(token);

    // 1. Use the GitHub API to download the database using token
    const dbZip = await downloadDatabase(token, nwo, language);
    await unbundleDatabase(dbZip);

    // 2. Run the query
    await runQuery(codeql, language, "database", query, nwo);

    // 3. Upload the results as an artifact
    const artifactClient = artifact.create();
    await artifactClient.uploadArtifact(
      nwo.replace("/", "#"), // name
      ["results/results.bqrs", "results/results.csv", "results/results.md"], // files
      "results", // rootdirectory
      { continueOnError: false, retentionDays: 1 }
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

void run();
