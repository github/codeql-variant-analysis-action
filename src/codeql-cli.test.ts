import fs from "fs";
import { tmpdir } from "os";
import path from "path";

import { rmRF } from "@actions/io";
import anyTest, { TestFn } from "ava";

import { getQueryPackInfo } from "./codeql";
import { CodeqlCli, CodeqlCliServer } from "./codeql-cli";

const test = anyTest as TestFn<{
  tmpDir: string;
  cli: CodeqlCli;
}>;

test.before((t) => {
  t.context.cli = new CodeqlCliServer(process.env.CODEQL_BIN_PATH || "codeql");
});

test.after((t) => {
  if (t.context.cli && t.context.cli instanceof CodeqlCliServer) {
    t.context.cli.shutdown();
  }
});

test.beforeEach((t) => {
  // Use a different temporary directory that tests can use
  t.context.tmpDir = path.resolve(fs.mkdtempSync(path.join(tmpdir(), "tmp-")));
});

test.afterEach(async (t) => {
  if (t.context?.tmpDir !== undefined) {
    await rmRF(t.context.tmpDir);
  }
});

test("create and bundle a database", async (t) => {
  const projectDir = path.join(t.context.tmpDir, "project");
  const dbDir = path.join(t.context.tmpDir, "db");
  fs.mkdirSync(projectDir);
  const testFile = path.join(projectDir, "test.js");
  fs.writeFileSync(testFile, "const x = 1;");

  await t.context.cli.run([
    "database",
    "create",
    "--language=javascript",
    `--source-root=${projectDir}`,
    dbDir,
  ]);

  const dbZip = path.join(t.context.tmpDir, "database.zip");
  await t.context.cli.run(["database", "bundle", `--output=${dbZip}`, dbDir]);

  t.true(fs.statSync(dbZip).isFile());
});

test("getting query pack info", async (t) => {
  const queryPackInfo = await getQueryPackInfo(
    t.context.cli,
    "testdata/test_pack",
  );

  const queries = {};
  queries[path.resolve("testdata/test_pack/x/query.ql")] = {
    name: "Test query",
    description: "Test query description",
    kind: "table",
    id: "test/query/id",
  };
  t.deepEqual(queryPackInfo, {
    path: path.resolve("testdata/test_pack"),
    name: "codeql/queries",
    queries,
  });
});
