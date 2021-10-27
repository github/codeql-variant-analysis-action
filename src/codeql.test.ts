import fs from "fs";
import path from "path";

import { exec } from "@actions/exec";
import { rmRF } from "@actions/io";
import test from "ava";

import { runQuery } from "./codeql";

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
  await rmRF(t.context.tmpDir);
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
