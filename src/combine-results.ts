import fs from "fs";
import path from "path";

import {
  ArtifactClient,
  create as createArtifactClient,
  DownloadResponse,
} from "@actions/artifact";
import { getInput, notice, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { mkdirP, mv } from "@actions/io";
import { extractTar } from "@actions/tool-cache";

import { getRemoteQueryPackDefaultQuery } from "./codeql";
import { download } from "./download";
import {
  createResultIndex,
  createResultsMd,
  ResultIndexItem,
} from "./interpret";

type Octokit = InstanceType<typeof GitHub>;

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

${results}
${errors}`;

async function run(): Promise<void> {
  try {
    const language = getInput("language", { required: true });
    const token = getInput("token", { required: true });
    const codeql = getInput("codeql", { required: true });
    const queryText = await getQueryText(codeql);

    const artifactClient = createArtifactClient();
    const [resultArtifacts, errorArtifacts] = await downloadArtifacts(
      artifactClient
    );

    await mkdirP("results");

    const octokit = getOctokit(token);
    const title = `Query run by ${context.actor} against ${resultArtifacts.length} \`${language}\` repositories`;
    const issue = await octokit.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title,
    });

    await Promise.all([
      uploadCSVs(resultArtifacts, artifactClient),
      uploadResultIndex(resultArtifacts, artifactClient),
      updateIssueBody(
        octokit,
        issue.data.number,
        queryText,
        resultArtifacts,
        errorArtifacts
      ),
    ]);

    notice(`Results now available at ${issue.data.html_url}`);
  } catch (error: any) {
    setFailed(error.message);
  }
}

async function getQueryText(codeql: string): Promise<string> {
  const queryPackUrl = getInput("query_pack_url", { required: true });
  console.log("Getting query pack");
  const queryPackArchive = await download(queryPackUrl, "query_pack.tar.gz");
  const queryPack = await extractTar(queryPackArchive);
  const queryFile = await getRemoteQueryPackDefaultQuery(codeql, queryPack);
  if (queryFile === undefined) {
    return "Unable to display executed query";
  } else {
    return await fs.promises.readFile(queryFile, "utf8");
  }
}

async function downloadArtifacts(
  artifactClient: ArtifactClient
): Promise<[DownloadResponse[], DownloadResponse[]]> {
  await mkdirP("artifacts");
  const downloadResponse = await artifactClient.downloadAllArtifacts(
    "artifacts"
  );

  // See if there are any "error" artifacts and if so, let the user know in the issue
  const errorArtifacts = downloadResponse.filter((artifact) =>
    artifact.artifactName.includes("error")
  );

  // Result artifacts are the non-error artifacts
  const resultArtifacts = downloadResponse.filter(
    (artifact) => !errorArtifacts.includes(artifact)
  );

  return [resultArtifacts, errorArtifacts];
}

async function uploadCSVs(
  resultArtifacts: DownloadResponse[],
  artifactClient: ArtifactClient
) {
  const csvs = await Promise.all(
    resultArtifacts.map(async function (response) {
      const csv = path.join(response.downloadPath, "results.csv");
      const csvDest = path.join("results", response.artifactName);
      await mv(csv, csvDest);
      return csvDest;
    })
  );

  await artifactClient.uploadArtifact(
    "all-results", // name
    csvs, // files
    "results", // rootdirectory
    { continueOnError: false }
  );
}

async function uploadResultIndex(
  resultArtifacts: DownloadResponse[],
  artifactClient: ArtifactClient
) {
  const resultsIndex: ResultIndexItem[] = await createResultIndex(
    resultArtifacts
  );

  // Create the index.json file
  const resultIndexFile = path.join("results", "index.json");
  await fs.promises.writeFile(
    resultIndexFile,
    JSON.stringify(resultsIndex, null, 2)
  );

  await artifactClient.uploadArtifact(
    "result-index", // name
    [resultIndexFile], // files
    "results", // rootdirectory
    { continueOnError: false }
  );
}

async function updateIssueBody(
  octokit: Octokit,
  issueNumber: number,
  queryText: string,
  resultArtifacts: DownloadResponse[],
  errorArtifacts: DownloadResponse[]
) {
  const resultsMd = await createResultsMd(
    octokit,
    issueNumber,
    resultArtifacts
  );
  let errorsMd = "";
  if (errorArtifacts.length > 0) {
    const workflowRunUrl = `${process.env["GITHUB_SERVER_URL"]}/${process.env["GITHUB_REPOSITORY"]}/actions/runs/${process.env["GITHUB_RUN_ID"]}`;
    errorsMd = `\n\nNote: The query failed to run on some repositories. For more details, see the [logs](${workflowRunUrl}).`;
  }
  const body = formatBody(queryText, resultsMd, errorsMd);

  await octokit.rest.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    body,
  });
}

void run();
