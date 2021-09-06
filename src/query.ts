import { mkdtempSync } from "fs";
import path from "path";
import { chdir, cwd } from "process";

import { create as createArtifactClient } from "@actions/artifact";
import { getInput, setSecret, setFailed } from "@actions/core";

import { downloadDatabase, unbundleDatabase, runQuery } from "./codeql";

async function run(): Promise<void> {
  try {
    const query = getInput("query", { required: true });
    const language = getInput("language", { required: true });
    const nwos: string[] = JSON.parse(
      getInput("repositories", { required: true })
    );
    const token = getInput("token", { required: true });
    const codeql = getInput("codeql", { required: true });

    setSecret(token);

    const curDir = cwd();
    for (const nwo of nwos) {
      const safeNwo = nwo.replace("/", "#");
      const workDir = mkdtempSync(path.join(curDir, safeNwo));
      chdir(workDir);

      // 1. Use the GitHub API to download the database using token
      const dbZip = await downloadDatabase(token, nwo, language);
      await unbundleDatabase(dbZip);

      // 2. Run the query
      await runQuery(codeql, language, "database", query, nwo);

      // 3. Upload the results as an artifact
      const artifactClient = createArtifactClient();
      await artifactClient.uploadArtifact(
        safeNwo, // name
        ["results/results.bqrs", "results/results.csv", "results/results.md"], // files
        "results", // rootdirectory
        { continueOnError: false, retentionDays: 1 }
      );
    }
  } catch (error) {
    setFailed(error.message);
  }
}

void run();
