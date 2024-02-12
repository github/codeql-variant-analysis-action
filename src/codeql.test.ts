import fs from "fs";
import { tmpdir } from "os";
import path from "path";

import { exec } from "@actions/exec";
import { rmRF } from "@actions/io";
import anyTest, { TestFn } from "ava";

import {
  runQuery,
  getBqrsInfo,
  getDatabaseMetadata,
  BQRSInfo,
  getQueryPackQueries,
  injectVersionControlInfo,
  getSarifResultCount,
  Sarif,
  getSarifOutputType,
  QueryMetadata,
  getBqrsResultCount,
  getQueryPackInfo,
} from "./codeql";

const test = anyTest as TestFn<{
  db: string;
  tmpDir: string;
  dbTmpDir: string;
}>;

test.before(async (t) => {
  const dbTmpDir = path.resolve(fs.mkdtempSync(path.join(tmpdir(), "db-")));
  t.context.dbTmpDir = dbTmpDir;

  const projectDir = path.join(dbTmpDir, "project");
  const dbDir = path.join(dbTmpDir, "db");
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

  const dbZip = path.join(dbTmpDir, "database.zip");
  await exec("codeql", ["database", "bundle", `--output=${dbZip}`, dbDir]);
  t.context.db = dbZip;
});

test.after(async (t) => {
  if (t.context?.dbTmpDir) {
    await rmRF(t.context.dbTmpDir);
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

test("getting query pack info", async (t) => {
  const queryPackInfo = await getQueryPackInfo("codeql", "testdata/test_pack");

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

test("getting query pack info with multiple queries", async (t) => {
  const queryPackInfo = await getQueryPackInfo(
    "codeql",
    "testdata/test_pack_multiple_queries",
  );

  const queries = {};
  queries[path.resolve("testdata/test_pack_multiple_queries/x/query.ql")] = {
    name: "Test query 1",
    kind: "table",
    id: "test/query/one",
  };
  queries[path.resolve("testdata/test_pack_multiple_queries/z/query.ql")] = {
    name: "Test query 2",
    kind: "table",
    id: "test/query/two",
  };
  t.deepEqual(queryPackInfo, {
    path: path.resolve("testdata/test_pack_multiple_queries"),
    name: "codeql/queries",
    queries,
  });
});

test("running a query in a pack", async (t) => {
  const queryPack = await getQueryPackInfo("codeql", "testdata/test_pack");
  const cwd = process.cwd();
  process.chdir(t.context.tmpDir);
  try {
    await runQuery("codeql", t.context.db, "a/b", queryPack);

    t.true(fs.existsSync(path.join("results", "results.bqrs")));
    t.false(fs.existsSync(path.join("results", "codeql/queries/x/query.bqrs")));

    const bqrsInfo: BQRSInfo = await getBqrsInfo(
      "codeql",
      path.join("results", "results.bqrs"),
    );
    t.is(1, bqrsInfo.resultSets.length);
    t.is("#select", bqrsInfo.resultSets[0].name);
    t.true(bqrsInfo.compatibleQueryKinds.includes("Table"));
  } finally {
    process.chdir(cwd);
    await rmRF(t.context.tmpDir);
  }
});

test("running multiple queries in a pack", async (t) => {
  const queryPack = await getQueryPackInfo(
    "codeql",
    "testdata/test_pack_multiple_queries",
  );
  const cwd = process.cwd();
  process.chdir(t.context.tmpDir);
  try {
    await runQuery("codeql", t.context.db, "a/b", queryPack);

    const bqrsFilePath1 = "db/results/codeql/queries/x/query.bqrs";
    t.true(fs.existsSync(bqrsFilePath1));

    const bqrsInfo1 = await getBqrsInfo("codeql", bqrsFilePath1);
    t.is(1, bqrsInfo1.resultSets.length);
    t.is("#select", bqrsInfo1.resultSets[0].name);
    t.true(bqrsInfo1.compatibleQueryKinds.includes("Table"));

    const bqrsFilePath2 = "db/results/codeql/queries/z/query.bqrs";
    t.true(fs.existsSync(bqrsFilePath2));

    const bqrsInfo2 = await getBqrsInfo("codeql", bqrsFilePath2);
    t.is(1, bqrsInfo2.resultSets.length);
    t.is("#select", bqrsInfo2.resultSets[0].name);
    t.true(bqrsInfo2.compatibleQueryKinds.includes("Table"));

    t.false(fs.existsSync(path.join("results", "results.bqrs")));
  } finally {
    process.chdir(cwd);
  }
});

test("getting the commit SHA and CLI version from a database", (t) => {
  fs.writeFileSync(
    path.join(t.context.tmpDir, "codeql-database.yml"),
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
`,
  );
  t.is(
    getDatabaseMetadata(t.context.tmpDir).creationMetadata?.sha,
    "ccf1e13626d97b009b4da78f719f028d9f7cdf80",
  );
  t.is(
    getDatabaseMetadata(t.context.tmpDir).creationMetadata?.cliVersion,
    "2.7.2",
  );
});

test("getting the commit SHA when codeql-database.yml exists, but does not contain SHA", (t) => {
  fs.writeFileSync(
    path.join(t.context.tmpDir, "codeql-database.yml"),
    `---
sourceLocationPrefix: "hello-world"
baselineLinesOfCode: 17442
unicodeNewlines: true
columnKind: "utf16"
primaryLanguage: "javascript"
`,
  );
  t.is(getDatabaseMetadata(t.context.tmpDir).creationMetadata?.sha, undefined);
});

test("getting the commit SHA when codeql-database.yml exists, but is invalid", (t) => {
  fs.writeFileSync(
    path.join(t.context.tmpDir, "codeql-database.yml"),
    `    foo:"
bar
`,
  );
  t.is(getDatabaseMetadata(t.context.tmpDir).creationMetadata?.sha, undefined);
});

test("getting the commit SHA when the codeql-database.yml does not exist", (t) => {
  t.is(getDatabaseMetadata(t.context.tmpDir).creationMetadata?.sha, undefined);
});

test("getting the queries from a pack", async (t) => {
  t.deepEqual(
    await getQueryPackQueries("codeql", "testdata/test_pack", "codeql/queries"),
    [path.resolve("testdata/test_pack/x/query.ql")],
  );
});

test("populating the SARIF versionControlProvenance property", (t) => {
  const sarif: Sarif = {
    runs: [
      {
        results: [],
      },
    ],
  };
  const nwo = "a/b";
  const sha = "testsha123";

  injectVersionControlInfo(sarif, nwo, sha);
  const expected = {
    repositoryUri: `https://github.com/${nwo}`,
    revisionId: sha,
  };

  t.deepEqual(sarif.runs[0].versionControlProvenance?.[0], expected);
});

test("counting the number of results in a SARIF file)", (t) => {
  const sarif: Sarif = {
    runs: [
      {
        results: [
          {
            ruleId: "test-rule1",
          },
          {
            ruleId: "test-rule2",
          },
          {
            ruleId: "test-rule3",
          },
        ],
      },
    ],
  };

  const resultCount = getSarifResultCount(sarif);
  t.is(resultCount, 3);
});

test("getting the SARIF output type when there is no `@kind` metadata", (t) => {
  const queryMetadata: QueryMetadata = {};

  const compatibleQueryKinds = [
    "Problem",
    "PathProblem",
    "Table",
    "Diagnostic",
  ];

  t.is(getSarifOutputType(queryMetadata, compatibleQueryKinds), undefined);
});

test("getting the SARIF output type when the `@kind` metadata is not compatible with output", (t) => {
  const queryMetadata: QueryMetadata = {
    kind: "path-problem",
  };

  const compatibleQueryKinds = ["Problem", "Table", "Diagnostic"];

  t.is(getSarifOutputType(queryMetadata, compatibleQueryKinds), undefined);
});

test("getting the SARIF output type when the `@kind` metadata is compatible with output", (t) => {
  const queryMetadata: QueryMetadata = {
    kind: "problem",
  };

  const compatibleQueryKinds = [
    "Problem",
    "PathProblem",
    "Table",
    "Diagnostic",
  ];

  t.is(getSarifOutputType(queryMetadata, compatibleQueryKinds), "problem");
});

test("uses result count from #select result set if it exists", (t) => {
  const bqrsInfo: BQRSInfo = {
    resultSets: [{ name: "#select", rows: 3 }],
    compatibleQueryKinds: [],
  };

  t.is(getBqrsResultCount(bqrsInfo), 3);
});

test("uses result count from problems result set if it exists", (t) => {
  const bqrsInfo: BQRSInfo = {
    resultSets: [{ name: "problems", rows: 4 }],
    compatibleQueryKinds: [],
  };

  t.is(getBqrsResultCount(bqrsInfo), 4);
});

test("uses result count from #select result set if both #select and problems result sets exist", (t) => {
  const bqrsInfo: BQRSInfo = {
    resultSets: [
      { name: "#select", rows: 3 },
      { name: "problems", rows: 4 },
    ],
    compatibleQueryKinds: [],
  };

  t.is(getBqrsResultCount(bqrsInfo), 3);
});

test("throws error if neither #select or problems result sets exist", (t) => {
  const bqrsInfo: BQRSInfo = {
    resultSets: [
      { name: "something", rows: 13 },
      { name: "unknown", rows: 42 },
    ],
    compatibleQueryKinds: [],
  };

  const error = t.throws(() => getBqrsResultCount(bqrsInfo));
  t.deepEqual(
    error?.message,
    "BQRS does not contain any result sets matching known names. Expected one of #select or problems but found something, unknown",
  );
});
