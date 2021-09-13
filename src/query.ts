import { mkdtempSync } from "fs";
import path from "path";
import { chdir, cwd } from "process";

import { create as createArtifactClient } from "@actions/artifact";
import { getInput, setSecret, setFailed } from "@actions/core";
import * as filenamify from "filenamify";

import { downloadDatabase, runQuery } from "./codeql";

interface Repo {
  id: number;
  nwo: string;
  token: string;
}

async function run(): Promise<void> {
  try {
    const query = getInput("query", { required: true });
    const language = getInput("language", { required: true });
    const repos: Repo[] = JSON.parse(
      getInput("repositories", { required: true })
    );
    const codeql = getInput("codeql", { required: true });

    for (const repo of repos) {
      setSecret(repo.token);
    }

    // 1. Use the GitHub API to download the database using token
    const curDir = cwd();
    for (const repo of repos) {
      const safeNwo = filenamify.path(repo.nwo);
      const workDir = mkdtempSync(path.join(curDir, safeNwo));
      chdir(workDir);

      // 1. Use the GitHub API to download the database using token
      const dbZip = await downloadDatabase(repo.token, repo.id, language);

      // 2. Run the query
      await runQuery(codeql, language, dbZip, query, repo.nwo);

      // 3. Upload the results as an artifact
      const artifactClient = createArtifactClient();
      await artifactClient.uploadArtifact(
        safeNwo, // name
        [
          "results/results.bqrs",
          "results/results.csv",
          "results/results.md",
          "results/nwo.txt",
        ], // files
        "results", // rootdirectory
        { continueOnError: false, retentionDays: 1 }
      );
    }
  } catch (error) {
    setFailed(error.message);
  }
}

void run();
