import fs from "fs";
import { tmpdir } from "os";
import path, { join } from "path";

import { rmRF } from "@actions/io";

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
import { BaseCodeqlCli, CodeqlCli } from "./codeql-cli";

describe("codeql", () => {
  const codeql: CodeqlCli = new BaseCodeqlCli(
    process.env.CODEQL_BIN_PATH || "codeql",
  );
  const cwd = process.cwd();

  let db: string;
  let tmpDir: string;
  let dbTmpDir: string;

  beforeAll(
    async () => {
      dbTmpDir = path.resolve(fs.mkdtempSync(path.join(tmpdir(), "db-")));

      const projectDir = path.join(dbTmpDir, "project");
      const dbDir = path.join(dbTmpDir, "db");
      fs.mkdirSync(projectDir);
      const testFile = path.join(projectDir, "test.js");
      fs.writeFileSync(testFile, "const x = 1;");

      await codeql.run([
        "database",
        "create",
        "--language=javascript",
        `--source-root=${projectDir}`,
        dbDir,
      ]);

      db = path.join(dbTmpDir, "database.zip");
      await codeql.run(["database", "bundle", `--output=${db}`, dbDir]);
    },
    // 5 minute timeout to build a CodeQL database
    5 * 60 * 1000,
  );

  afterAll(
    async () => {
      if (dbTmpDir) {
        await rmRF(dbTmpDir);
      }
    },
    // 30 second timeout to delete an unzipped CodeQL database
    30 * 1000,
  );

  beforeEach(() => {
    // Use a different temporary directory that tests can use
    tmpDir = path.resolve(fs.mkdtempSync(path.join(tmpdir(), "tmp-")));
  });

  afterEach(async () => {
    if (tmpDir !== undefined) {
      await rmRF(tmpDir);
    }
  });

  describe("getQueryPackInfo", () => {
    it("gets query pack info", async () => {
      const queryPackInfo = await getQueryPackInfo(
        codeql,
        join(cwd, "testdata/test_pack"),
      );

      const queries = {};
      queries[path.resolve("testdata/test_pack/x/query.ql")] = {
        name: "Test query",
        description: "Test query description",
        kind: "table",
        id: "test/query/id",
      };
      expect(queryPackInfo).toEqual({
        path: path.resolve("testdata/test_pack"),
        name: "codeql/queries",
        queries,
      });
    });

    it("gets query pack info when there are multiple queries", async () => {
      const queryPackInfo = await getQueryPackInfo(
        codeql,
        join(cwd, "testdata/test_pack_multiple_queries"),
      );

      const queries = {};
      queries[path.resolve("testdata/test_pack_multiple_queries/x/query.ql")] =
        {
          name: "Test query 1",
          kind: "table",
          id: "test/query/one",
        };
      queries[path.resolve("testdata/test_pack_multiple_queries/z/query.ql")] =
        {
          name: "Test query 2",
          kind: "table",
          id: "test/query/two",
        };
      expect(queryPackInfo).toEqual({
        path: path.resolve("testdata/test_pack_multiple_queries"),
        name: "codeql/queries",
        queries,
      });
    });
  });

  describe("runQuery", () => {
    beforeEach(() => {
      // Change to the temporary directory because some tests write files to the current working directory
      process.chdir(tmpDir);
    });

    afterEach(() => {
      process.chdir(cwd);
    });

    it(
      "runs a query in a pack",
      async () => {
        const queryPack = await getQueryPackInfo(
          codeql,
          join(cwd, "testdata/test_pack"),
        );
        await runQuery(codeql, db, "a/b", queryPack);

        expect(fs.existsSync(path.join("results", "results.bqrs"))).toBe(true);
        expect(
          fs.existsSync(path.join("results", "codeql/queries/x/query.bqrs")),
        ).toBe(false);

        const bqrsInfo: BQRSInfo = await getBqrsInfo(
          codeql,
          path.join("results", "results.bqrs"),
        );
        expect(bqrsInfo.resultSets.length).toBe(1);
        expect(bqrsInfo.resultSets[0].name).toBe("#select");
        expect(bqrsInfo.compatibleQueryKinds.includes("Table")).toBe(true);
      },
      // 1 minute timeout to run a CodeQL query
      60 * 1000,
    );

    it(
      "runs multiple queries in a pack",
      async () => {
        const queryPack = await getQueryPackInfo(
          codeql,
          join(cwd, "testdata/test_pack_multiple_queries"),
        );
        await runQuery(codeql, db, "a/b", queryPack);

        const bqrsFilePath1 = "db/results/codeql/queries/x/query.bqrs";
        expect(fs.existsSync(bqrsFilePath1)).toBe(true);

        const bqrsInfo1 = await getBqrsInfo(codeql, bqrsFilePath1);
        expect(bqrsInfo1.resultSets.length).toBe(1);
        expect(bqrsInfo1.resultSets[0].name).toBe("#select");
        expect(bqrsInfo1.compatibleQueryKinds.includes("Table")).toBe(true);

        const bqrsFilePath2 = "db/results/codeql/queries/z/query.bqrs";
        expect(fs.existsSync(bqrsFilePath2)).toBe(true);

        const bqrsInfo2 = await getBqrsInfo(codeql, bqrsFilePath2);
        expect(bqrsInfo2.resultSets.length).toBe(1);
        expect(bqrsInfo2.resultSets[0].name).toBe("#select");
        expect(bqrsInfo2.compatibleQueryKinds.includes("Table")).toBe(true);

        expect(fs.existsSync(path.join("results", "results.bqrs"))).toBe(false);
      },
      // 1 minute timeout to run a CodeQL query
      60 * 1000,
    );
  });

  describe("getDatabaseMetadata", () => {
    it("gets the commit SHA and CLI version from a database", () => {
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
    `,
      );
      expect(getDatabaseMetadata(tmpDir).creationMetadata?.sha).toBe(
        "ccf1e13626d97b009b4da78f719f028d9f7cdf80",
      );
      expect(getDatabaseMetadata(tmpDir).creationMetadata?.cliVersion).toBe(
        "2.7.2",
      );
    });

    it("gets the commit SHA when codeql-database.yml exists, but does not contain SHA", () => {
      fs.writeFileSync(
        path.join(tmpDir, "codeql-database.yml"),
        `---
    sourceLocationPrefix: "hello-world"
    baselineLinesOfCode: 17442
    unicodeNewlines: true
    columnKind: "utf16"
    primaryLanguage: "javascript"
    `,
      );
      expect(getDatabaseMetadata(tmpDir).creationMetadata?.sha).toBe(undefined);
    });

    it("gets the commit SHA when codeql-database.yml exists, but is invalid", () => {
      fs.writeFileSync(
        path.join(tmpDir, "codeql-database.yml"),
        `    foo:"
    bar
    `,
      );
      expect(getDatabaseMetadata(tmpDir).creationMetadata?.sha).toBe(undefined);
    });

    it("gets the commit SHA when the codeql-database.yml does not exist", () => {
      expect(getDatabaseMetadata(tmpDir).creationMetadata?.sha).toBe(undefined);
    });
  });

  describe("getQueryPackQueries", () => {
    it("gets the queries from a pack", async () => {
      expect(
        await getQueryPackQueries(
          codeql,
          "testdata/test_pack",
          "codeql/queries",
        ),
      ).toEqual([path.resolve("testdata/test_pack/x/query.ql")]);
    });
  });

  describe("injectVersionControlInfo", () => {
    it("populates the SARIF versionControlProvenance property", () => {
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

      expect(sarif.runs[0].versionControlProvenance?.[0]).toEqual(expected);
    });
  });

  describe("getSarifResultCount", () => {
    it("counts the number of results in a SARIF file)", () => {
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

      expect(getSarifResultCount(sarif)).toBe(3);
    });
  });

  describe("getSarifOutputType", () => {
    it("gets the SARIF output type when there is no `@kind` metadata", () => {
      const queryMetadata: QueryMetadata = {};

      const compatibleQueryKinds = [
        "Problem",
        "PathProblem",
        "Table",
        "Diagnostic",
      ];

      expect(getSarifOutputType(queryMetadata, compatibleQueryKinds)).toBe(
        undefined,
      );
    });

    it("gets the SARIF output type when the `@kind` metadata is not compatible with output", () => {
      const queryMetadata: QueryMetadata = {
        kind: "path-problem",
      };

      const compatibleQueryKinds = ["Problem", "Table", "Diagnostic"];

      expect(getSarifOutputType(queryMetadata, compatibleQueryKinds)).toBe(
        undefined,
      );
    });

    it("gets the SARIF output type when the `@kind` metadata is compatible with output", () => {
      const queryMetadata: QueryMetadata = {
        kind: "problem",
      };

      const compatibleQueryKinds = [
        "Problem",
        "PathProblem",
        "Table",
        "Diagnostic",
      ];

      expect(getSarifOutputType(queryMetadata, compatibleQueryKinds)).toBe(
        "problem",
      );
    });

    it("gets the SARIF output type when the `@kind` metadata is an alert alias", () => {
      const queryMetadata: QueryMetadata = {
        kind: "alert",
      };

      const compatibleQueryKinds = [
        "Problem",
        "PathProblem",
        "Table",
        "Diagnostic",
      ];

      expect(getSarifOutputType(queryMetadata, compatibleQueryKinds)).toBe(
        "problem",
      );
    });

    it("gets the SARIF output type when the `@kind` metadata is a path-alert alias", () => {
      const queryMetadata: QueryMetadata = {
        kind: "path-alert",
      };

      const compatibleQueryKinds = [
        "Problem",
        "PathProblem",
        "Table",
        "Diagnostic",
      ];

      expect(getSarifOutputType(queryMetadata, compatibleQueryKinds)).toBe(
        "path-problem",
      );
    });
  });

  describe("getBqrsResultCount", () => {
    it("uses result count from #select result set if it exists", () => {
      const bqrsInfo: BQRSInfo = {
        resultSets: [{ name: "#select", rows: 3 }],
        compatibleQueryKinds: [],
      };

      expect(getBqrsResultCount(bqrsInfo)).toBe(3);
    });

    it("uses result count from problems result set if it exists", () => {
      const bqrsInfo: BQRSInfo = {
        resultSets: [{ name: "problems", rows: 4 }],
        compatibleQueryKinds: [],
      };

      expect(getBqrsResultCount(bqrsInfo)).toBe(4);
    });

    it("uses result count from #select result set if both #select and problems result sets exist", () => {
      const bqrsInfo: BQRSInfo = {
        resultSets: [
          { name: "#select", rows: 3 },
          { name: "problems", rows: 4 },
        ],
        compatibleQueryKinds: [],
      };

      expect(getBqrsResultCount(bqrsInfo)).toBe(3);
    });

    it("throws error if neither #select or problems result sets exist", () => {
      const bqrsInfo: BQRSInfo = {
        resultSets: [
          { name: "something", rows: 13 },
          { name: "unknown", rows: 42 },
        ],
        compatibleQueryKinds: [],
      };

      expect(() => getBqrsResultCount(bqrsInfo)).toThrow(
        new Error(
          "BQRS does not contain any result sets matching known names. Expected one of #select or problems but found something, unknown",
        ),
      );
    });
  });
});
