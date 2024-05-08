import fs from "fs";
import { tmpdir } from "os";
import path from "path";

import { rmRF } from "@actions/io";

import { getQueryPackInfo } from "./codeql";
import { CodeqlCli, CodeqlCliServer } from "./codeql-cli";

describe("codeql-cli", () => {
  let cli: CodeqlCli;
  let tmpDir: string;

  beforeAll(() => {
    cli = new CodeqlCliServer(process.env.CODEQL_BIN_PATH || "codeql");
  });

  afterAll(() => {
    if (cli && cli instanceof CodeqlCliServer) {
      cli.shutdown();
    }
  });

  beforeEach(() => {
    tmpDir = path.resolve(fs.mkdtempSync(path.join(tmpdir(), "tmp-")));
  });

  afterEach(async () => {
    if (tmpDir !== undefined) {
      await rmRF(tmpDir);
    }
  });

  it(
    "create and bundle a database",
    async () => {
      const projectDir = path.join(tmpDir, "project");
      const dbDir = path.join(tmpDir, "db");
      fs.mkdirSync(projectDir);
      const testFile = path.join(projectDir, "test.js");
      fs.writeFileSync(testFile, "const x = 1;");

      await cli.run([
        "database",
        "create",
        "--language=javascript",
        `--source-root=${projectDir}`,
        dbDir,
      ]);

      const dbZip = path.join(tmpDir, "database.zip");
      await cli.run(["database", "bundle", `--output=${dbZip}`, dbDir]);

      expect(fs.statSync(dbZip).isFile()).toBe(true);
    },
    // 5 minute timeout to create and bundle a database
    5 * 60 * 1000,
  );

  it("getting query pack info", async () => {
    const queryPackInfo = await getQueryPackInfo(cli, "testdata/test_pack");

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
});
