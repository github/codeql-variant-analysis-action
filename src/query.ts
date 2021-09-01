import { create as createArtifactClient } from "@actions/artifact";
import { getInput, setSecret, setFailed } from "@actions/core";

import { downloadDatabase, runQuery } from "./codeql";

async function run(): Promise<void> {
  try {
    const query = getInput("query", { required: true });
    const language = getInput("language", { required: true });
    const nwo = getInput("repository", { required: true });
    const token = getInput("token", { required: true });
    const codeql = getInput("codeql", { required: true });

    setSecret(token);

    // 1. Use the GitHub API to download the database using token
    const dbZip = await downloadDatabase(token, nwo, language);

    // 2. Run the query
    await runQuery(codeql, language, dbZip, query, nwo);

    // 3. Upload the results as an artifact
    const artifactClient = createArtifactClient();
    await artifactClient.uploadArtifact(
      nwo.replace("/", "#"), // name
      ["results/results.bqrs", "results/results.csv", "results/results.md"], // files
      "results", // rootdirectory
      { continueOnError: false, retentionDays: 1 }
    );
  } catch (error) {
    setFailed(error.message);
  }
}

void run();
