import fs from "fs";
import path from "path";

import { create as createArtifactClient } from "@actions/artifact";
import { getInput, notice, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { mkdirP, mv } from "@actions/io";
import { extractTar } from "@actions/tool-cache";

import { download } from "./download";
import {
  createResultIndex,
  createResultsMd,
  ResultIndexItem,
} from "./interpret";

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
    const query = getInput("query") || undefined;
    const queryPackUrl = getInput("query_pack_url") || undefined;
    if ((query === undefined) === (queryPackUrl === undefined)) {
      setFailed("Exactly one of 'query' and 'query_pack_url' is required");
      return;
    }

    const language = getInput("language", { required: true });
    const token = getInput("token", { required: true });

    let queryText: string;
    if (queryPackUrl !== undefined) {
      console.log("Getting query pack");
      const queryPackArchive = await download(
        queryPackUrl,
        "query_pack.tar.gz"
      );
      const queryPack = await extractTar(queryPackArchive);
      queryText = fs.readFileSync(path.join(queryPack, "query.ql"), "utf-8");
    } else {
      queryText = query!; // Must be defined if queryPackUrl isn't
    }

    await mkdirP("artifacts");
    const artifactClient = createArtifactClient();
    const downloadResponse = await artifactClient.downloadAllArtifacts(
      "artifacts"
    );

    // See if there are any "error" artifacts and if so, let the user know in the issue
    const errorArtifacts = downloadResponse.filter((artifact) =>
      artifact.artifactName.includes("error")
    );
    let errorsMd = "";
    if (errorArtifacts.length > 0) {
      const workflowRunUrl = `${process.env["GITHUB_SERVER_URL"]}/${process.env["GITHUB_REPOSITORY"]}/actions/runs/${process.env["GITHUB_RUN_ID"]}`;
      errorsMd = `\n\nNote: The query failed to run on some repositories. For more details, see the [logs](${workflowRunUrl}).`;
    }

    // Result artifacts are the non-error artifacts
    const resultArtifacts = downloadResponse.filter(
      (artifact) => !errorArtifacts.includes(artifact)
    );

    // Stop if there are no result artifacts
    if (resultArtifacts.length === 0) {
      setFailed(
        "Unable to run query on any repositories. For more details, see the individual `run-query` jobs."
      );
      return;
    }

    await mkdirP("results");

    const octokit = getOctokit(token);
    const title = `Query run by ${context.actor} against ${resultArtifacts.length} \`${language}\` repositories`;
    const issue = await octokit.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title,
    });

    const csvs: string[] = await Promise.all(
      resultArtifacts.map(async function (response) {
        const csv = path.join(response.downloadPath, "results.csv");
        const csvDest = path.join("results", response.artifactName);
        await mv(csv, csvDest);
        return csvDest;
      })
    );

    const resultsMd = await createResultsMd(
      octokit,
      issue.data.number,
      resultArtifacts
    );

    const resultsIndex: ResultIndexItem[] = await createResultIndex(
      resultArtifacts
    );

    // Create the index.json file
    const resultIndexFile = path.join("results", "index.json");
    fs.writeFileSync(resultIndexFile, JSON.stringify(resultsIndex, null, 2));

    const body = formatBody(queryText, resultsMd, errorsMd);

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
      artifactClient.uploadArtifact(
        "result-index", // name
        [resultIndexFile], // files
        "results", // rootdirectory
        { continueOnError: false }
      ),
    ]);

    notice(`Results now available at ${issue.data.html_url}`);
  } catch (error: any) {
    setFailed(error.message);
  }
}

void run();
