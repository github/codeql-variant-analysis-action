import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import { chdir, cwd } from "process";

import { create as createArtifactClient } from "@actions/artifact";
import { getInput, setSecret, error } from "@actions/core";

import { downloadDatabase, runQuery } from "./codeql";

interface Repo {
  id: number;
  nwo: string;
  token?: string; // SignedAuthToken
  pat?: string;
}

async function run(): Promise<void> {
  const artifactClient = createArtifactClient();
  try {
    const query = getInput("query", { required: true });
    const language = getInput("language", { required: true });
    const repos: Repo[] = JSON.parse(
      getInput("repositories", { required: true })
    );
    const codeql = getInput("codeql", { required: true });

    for (const repo of repos) {
      if (repo.token) {
        setSecret(repo.token);
      }
      if (repo.pat) {
        setSecret(repo.pat);
      }
    }

    // 1. Use the GitHub API to download the database using token
    const curDir = cwd();
    for (const repo of repos) {
      const workDir = mkdtempSync(path.join(curDir, repo.id.toString()));
      chdir(workDir);

      // 1. Use the GitHub API to download the database using token
      const dbZip = await downloadDatabase(
        repo.id,
        language,
        repo.token,
        repo.pat
      );

      // 2. Run the query
      await runQuery(codeql, language, dbZip, query, repo.nwo);

      // 3. Upload the results as an artifact
      await artifactClient.uploadArtifact(
        repo.id.toString(), // name
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
  } catch (err: any) {
    error(err.message);
    // Also write error message to a file and upload it as an artifact
    mkdirSync("errors");
    const errorFile = path.join(cwd(), "errors", "error.txt");
    writeFileSync(errorFile, err.message);

    // Collect failures and upload as an artifact (so that combine-results has something to go on)
    await artifactClient.uploadArtifact(
      "error", // name
      ["errors/error.txt"], // files
      "errors", // rootdirectory
      { continueOnError: false, retentionDays: 1 }
    );
  }
}

void run();
