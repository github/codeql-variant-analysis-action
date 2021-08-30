import fs from "fs";
import path from "path";

import { exec } from "@actions/exec";
import { rmRF } from "@actions/io";
import archiver from "archiver";
import test from "ava";

import { runQuery, unbundleDatabase } from "./codeql";

test("unbundle creates a stable directory name", async (t) => {
  const tmpDir = fs.mkdtempSync("tmp");
  const cwd = process.cwd();
  process.chdir(tmpDir);
  try {
    const testText = "hello world";
    const dbFile = "example.zip";

    const output = fs.createWriteStream(dbFile);
    const archive = archiver("zip");
    archive.pipe(output);
    archive.append(testText, { name: "original-database-name/file.txt" });
    await archive.finalize();

    await unbundleDatabase(dbFile);

    t.is(fs.readFileSync(path.join("database", "file.txt"), "utf-8"), testText);
  } finally {
    process.chdir(cwd);
    await rmRF(tmpDir);
  }
});

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

    await runQuery(
      "codeql",
      "javascript",
      dbDir,
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
