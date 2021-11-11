import fs from "fs";
import path from "path";

import { exec } from "@actions/exec";
import { rmRF } from "@actions/io";
import test from "ava";

import { runQuery, getDatabaseSHA } from "./codeql";
import { createResultIndex } from "./interpret";

test.before(async (t: any) => {
  const tmpDir = path.resolve(fs.mkdtempSync("tmp"));
  t.context.tmpDir = tmpDir;

  const projectDir = path.join(tmpDir, "project");
  const dbDir = path.join(tmpDir, "db");
  fs.mkdirSync(projectDir);
  const testFile = path.join(projectDir, "test.js");
  fs.writeFileSync(testFile, "const x = 1;");

  await exec("codeql", [
    "database",
    "create",
    "--language=javascript",
    `--source-root=${projectDir}`,
    dbDir,
  ]);

  const dbZip = path.join(tmpDir, "database.zip");
  await exec("codeql", ["database", "bundle", `--output=${dbZip}`, dbDir]);
  t.context.db = dbZip;
});

test.after(async (t: any) => {
  if (t.context?.tmpDir !== undefined) {
    await rmRF(t.context.tmpDir);
  }
});

test("running a basic query", async (t: any) => {
  const tmpDir = fs.mkdtempSync("tmp");
  const cwd = process.cwd();
  process.chdir(tmpDir);
  try {
    await runQuery(
      "codeql",
      "javascript",
      t.context.db,
      "a/b",
      "import javascript\nfrom File f select f"
    );

    t.true(
      fs
        .readFileSync(path.join("results", "results.md"), "utf-8")
        .includes("test.js")
    );
    t.true(fs.existsSync(path.join("results", "results.bqrs")));
    t.true(fs.existsSync(path.join("results", "results.csv")));
  } finally {
    process.chdir(cwd);
    await rmRF(tmpDir);
  }
});

test("running a query in a pack", async (t: any) => {
  const testPack = path.resolve("testdata/test_pack");
  const tmpDir = fs.mkdtempSync("tmp");
  const cwd = process.cwd();
  process.chdir(tmpDir);
  try {
    await runQuery(
      "codeql",
      "javascript",
      t.context.db,
      "a/b",
      undefined,
      testPack
    );

    t.true(
      fs
        .readFileSync(path.join("results", "results.md"), "utf-8")
        .includes("| 0 | 1 |")
    );
    t.true(fs.existsSync(path.join("results", "results.bqrs")));
    t.true(fs.existsSync(path.join("results", "results.csv")));
  } finally {
    process.chdir(cwd);
    await rmRF(tmpDir);
  }
});

test("getting the commit SHA from a database", async (t: any) => {
  const tmpDir = fs.mkdtempSync("tmp");
  try {
    fs.writeFileSync(
      path.join(tmpDir, "codeql-database.yml"),
      `---
sourceLocationPrefix: "hello-world"
baselineLinesOfCode: 1
unicodeNewlines: true
columnKind: "utf16"
primaryLanguage: "javascript"
creationMetadata:
  sha: "ccf1e13626d97b009b4da78f719f028d9f7cdf80"
  cliVersion: "2.7.2"
  creationTime: "2021-11-08T12:58:40.345998Z"
`
    );
    t.is(getDatabaseSHA(tmpDir), "ccf1e13626d97b009b4da78f719f028d9f7cdf80");
  } finally {
    await rmRF(tmpDir);
  }
});

test("getting the commit SHA when codeql-database.yml exists, but does not contain SHA", async (t: any) => {
  const tmpDir = fs.mkdtempSync("tmp");
  try {
    fs.writeFileSync(
      path.join(tmpDir, "codeql-database.yml"),
      `---
sourceLocationPrefix: "hello-world"
baselineLinesOfCode: 17442
unicodeNewlines: true
columnKind: "utf16"
primaryLanguage: "javascript"
`
    );
    t.is(getDatabaseSHA(tmpDir), "HEAD");
  } finally {
    await rmRF(tmpDir);
  }
});

test("getting the commit SHA when codeql-database.yml exists, but is invalid", async (t: any) => {
  const tmpDir = fs.mkdtempSync("tmp");
  try {
    fs.writeFileSync(
      path.join(tmpDir, "codeql-database.yml"),
      `    foo:"
bar
`
    );
    t.is(getDatabaseSHA(tmpDir), "HEAD");
  } finally {
    await rmRF(tmpDir);
  }
});

test("getting the commit SHA when the codeql-database.yml does not exist", async (t: any) => {
  const tmpDir = fs.mkdtempSync("tmp");
  try {
    t.is(getDatabaseSHA(tmpDir), "HEAD");
  } finally {
    await rmRF(tmpDir);
  }
});

test("reading the metadata for a real database", async (t: any) => {
  const tmpDir = fs.mkdtempSync("tmp");
  const cwd = process.cwd();
  process.chdir(tmpDir);
  try {
    // Test the real database, which has no commit SHA (until CodeQL CLI 2.7.2 is released).
    // TODO: update this test once CodeQL CLI 2.7.2 is released.
    await exec("codeql", [
      "database",
      "unbundle",
      t.context.db,
      "--name=realDb",
    ]);
    const sha2 = getDatabaseSHA("realDb");
    t.is(sha2, "HEAD");
  } finally {
    process.chdir(cwd);
    await rmRF(tmpDir);
  }
});

test("creating a result index", async (t: any) => {
  const tmpDir = fs.mkdtempSync("tmp");
  const cwd = process.cwd();
  process.chdir(tmpDir);
  try {
    const output = await runQuery(
      "codeql",
      "javascript",
      t.context.db,
      "a/b",
      "import javascript\nfrom File f select f"
    );
    const outputDir = path.dirname(output[0]); // We know that all output files are in the same directory.
    const downloadResponse = {
      artifactName: "results",
      downloadPath: outputDir,
    };

    // createResultIndex expects an `nwo.txt` file to exist.
    const nwoFile = path.join(outputDir, "nwo.txt");
    fs.writeFileSync(nwoFile, "a/b");

    const result = await createResultIndex([downloadResponse]);

    t.is(result.length, 1);
    t.is(result[0].nwo, "a/b");
    t.is(result[0].id, "results");
    t.is(result[0].results_count, 1);
    t.is(result[0].bqrs_file_size, 111);
  } finally {
    process.chdir(cwd);
    await rmRF(tmpDir);
  }
});
