"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec_1 = require("@actions/exec");
const io_1 = require("@actions/io");
const ava_1 = __importDefault(require("ava"));
const codeql_1 = require("./codeql");
const interpret_1 = require("./interpret");
const test = ava_1.default;
test.before(async (t) => {
    const tmpDir = path_1.default.resolve(fs_1.default.mkdtempSync("tmp"));
    t.context.tmpDir = tmpDir;
    const projectDir = path_1.default.join(tmpDir, "project");
    const dbDir = path_1.default.join(tmpDir, "db");
    fs_1.default.mkdirSync(projectDir);
    const testFile = path_1.default.join(projectDir, "test.js");
    fs_1.default.writeFileSync(testFile, "const x = 1;");
    await (0, exec_1.exec)("codeql", [
        "database",
        "create",
        "--language=javascript",
        `--source-root=${projectDir}`,
        dbDir,
    ]);
    const dbZip = path_1.default.join(tmpDir, "database.zip");
    await (0, exec_1.exec)("codeql", ["database", "bundle", `--output=${dbZip}`, dbDir]);
    t.context.db = dbZip;
});
test.after(async (t) => {
    var _a;
    if (((_a = t.context) === null || _a === void 0 ? void 0 : _a.tmpDir) !== undefined) {
        await (0, io_1.rmRF)(t.context.tmpDir);
    }
});
test("running a query in a pack", async (t) => {
    const queryPack = path_1.default.resolve("testdata/test_pack");
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    const cwd = process.cwd();
    process.chdir(tmpDir);
    try {
        await (0, codeql_1.runQuery)("codeql", t.context.db, "a/b", queryPack);
        t.true(fs_1.default.existsSync(path_1.default.join("results", "results.bqrs")));
        const bqrsInfo = await (0, codeql_1.getBqrsInfo)("codeql", path_1.default.join("results", "results.bqrs"));
        t.is(1, bqrsInfo.resultSets.length);
        t.is("#select", bqrsInfo.resultSets[0].name);
        t.true(bqrsInfo.compatibleQueryKinds.includes("Table"));
    }
    finally {
        process.chdir(cwd);
        await (0, io_1.rmRF)(tmpDir);
    }
});
test("getting the commit SHA and CLI version from a database", async (t) => {
    var _a, _b;
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    try {
        fs_1.default.writeFileSync(path_1.default.join(tmpDir, "codeql-database.yml"), `---
sourceLocationPrefix: "hello-world"
baselineLinesOfCode: 1
unicodeNewlines: true
columnKind: "utf16"
primaryLanguage: "javascript"
creationMetadata:
  sha: "ccf1e13626d97b009b4da78f719f028d9f7cdf80"
  cliVersion: "2.7.2"
  creationTime: "2021-11-08T12:58:40.345998Z"
`);
        t.is((_a = (0, codeql_1.getDatabaseMetadata)(tmpDir).creationMetadata) === null || _a === void 0 ? void 0 : _a.sha, "ccf1e13626d97b009b4da78f719f028d9f7cdf80");
        t.is((_b = (0, codeql_1.getDatabaseMetadata)(tmpDir).creationMetadata) === null || _b === void 0 ? void 0 : _b.cliVersion, "2.7.2");
    }
    finally {
        await (0, io_1.rmRF)(tmpDir);
    }
});
test("getting the commit SHA when codeql-database.yml exists, but does not contain SHA", async (t) => {
    var _a;
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    try {
        fs_1.default.writeFileSync(path_1.default.join(tmpDir, "codeql-database.yml"), `---
sourceLocationPrefix: "hello-world"
baselineLinesOfCode: 17442
unicodeNewlines: true
columnKind: "utf16"
primaryLanguage: "javascript"
`);
        t.is((_a = (0, codeql_1.getDatabaseMetadata)(tmpDir).creationMetadata) === null || _a === void 0 ? void 0 : _a.sha, undefined);
    }
    finally {
        await (0, io_1.rmRF)(tmpDir);
    }
});
test("getting the commit SHA when codeql-database.yml exists, but is invalid", async (t) => {
    var _a;
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    try {
        fs_1.default.writeFileSync(path_1.default.join(tmpDir, "codeql-database.yml"), `    foo:"
bar
`);
        t.is((_a = (0, codeql_1.getDatabaseMetadata)(tmpDir).creationMetadata) === null || _a === void 0 ? void 0 : _a.sha, undefined);
    }
    finally {
        await (0, io_1.rmRF)(tmpDir);
    }
});
test("getting the commit SHA when the codeql-database.yml does not exist", async (t) => {
    var _a;
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    try {
        t.is((_a = (0, codeql_1.getDatabaseMetadata)(tmpDir).creationMetadata) === null || _a === void 0 ? void 0 : _a.sha, undefined);
    }
    finally {
        await (0, io_1.rmRF)(tmpDir);
    }
});
test("creating a result index", async (t) => {
    const queryPack = path_1.default.resolve("testdata/test_pack");
    const responsePath = path_1.default.resolve("testdata/test_download_response");
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    const cwd = process.cwd();
    process.chdir(tmpDir);
    try {
        const output = await (0, codeql_1.runQuery)("codeql", t.context.db, "a/b", queryPack);
        const outputDir = path_1.default.dirname(output.bqrsFilePath); // We know that all output files are in the same directory.
        const downloadResponse = {
            artifactName: "123",
            downloadPath: outputDir,
        };
        const downloadResponse2 = {
            artifactName: "124-error",
            downloadPath: responsePath,
        };
        const resultIndex = (0, interpret_1.createResultIndex)([downloadResponse], [downloadResponse2]);
        t.is(resultIndex.successes.length, 1);
        t.is(resultIndex.failures.length, 1);
        const successItem = resultIndex.successes[0];
        t.is(successItem.nwo, "a/b");
        t.is(successItem.id, "123");
        t.true(successItem.source_location_prefix.length > 0);
        t.is(successItem.results_count, 3);
        t.true(successItem.bqrs_file_size > 0);
        const failureItem = resultIndex.failures[0];
        t.is(failureItem.nwo, "a/c");
        t.is(failureItem.id, "124");
        t.is(failureItem.error, "Ceci n'est pas un error message.");
    }
    finally {
        process.chdir(cwd);
        await (0, io_1.rmRF)(tmpDir);
    }
});
test("getting the default query from a pack", async (t) => {
    t.is(await (0, codeql_1.getRemoteQueryPackDefaultQuery)("codeql", "testdata/test_pack"), path_1.default.resolve("testdata/test_pack/x/query.ql"));
});
test("populating the SARIF versionControlProvenance property", (t) => {
    const sarif = {
        $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        version: "2.1.0",
        runs: [
            {
                tool: {},
                artifacts: [],
                results: [],
                columnKind: "utf16CodeUnits",
                properties: {},
            },
        ],
    };
    const nwo = "a/b";
    const sha = "testsha123";
    (0, codeql_1.injectVersionControlInfo)(sarif, nwo, sha);
    const expected = {
        repositoryUri: `https://github.com/${nwo}`,
        revisionId: sha,
    };
    t.deepEqual(sarif.runs[0].versionControlProvenance[0], expected);
});
test("counting the number of results in a SARIF file)", (t) => {
    const sarif = {
        $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        version: "2.1.0",
        runs: [
            {
                tool: {},
                artifacts: [],
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
                columnKind: "utf16CodeUnits",
                properties: {},
            },
        ],
    };
    const resultCount = (0, codeql_1.getSarifResultCount)(sarif);
    t.is(resultCount, 3);
});
//# sourceMappingURL=codeql.test.js.map