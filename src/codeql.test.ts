import fs from "fs";
import path from "path";

import { exec } from "@actions/exec";
import { rmRF } from "@actions/io";
import test from "ava";

import { runQuery } from "./codeql";

test("running a basic query", async (t) => {
  const tmpDir = fs.mkdtempSync("tmp");
  const cwd = process.cwd();
  process.chdir(tmpDir);
  try {
    const projectDir = "project";
    const dbDir = "db";

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

    await exec("codeql", [
      "database",
      "bundle",
      "--output=database.zip",
      dbDir,
    ]);

    await runQuery(
      "codeql",
      "javascript",
      "database.zip",
      "import javascript\nfrom File f select f",
      "a/b"
    );

    t.true(
      fs
        .readFileSync(path.join("results", "results.md"), "utf-8")
        .includes(testFile)
    );
    t.true(fs.existsSync(path.join("results", "results.bqrs")));
    t.true(fs.existsSync(path.join("results", "results.csv")));
  } finally {
    process.chdir(cwd);
    await rmRF(tmpDir);
  }
});
