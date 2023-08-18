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
test("getting the default query from a pack", async (t) => {
    t.is(await (0, codeql_1.getRemoteQueryPackDefaultQuery)("codeql", "testdata/test_pack"), path_1.default.resolve("testdata/test_pack/x/query.ql"));
});
test("populating the SARIF versionControlProvenance property", (t) => {
    var _a;
    const sarif = {
        runs: [
            {
                results: [],
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
    t.deepEqual((_a = sarif.runs[0].versionControlProvenance) === null || _a === void 0 ? void 0 : _a[0], expected);
});
test("counting the number of results in a SARIF file)", (t) => {
    const sarif = {
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
    const resultCount = (0, codeql_1.getSarifResultCount)(sarif);
    t.is(resultCount, 3);
});
test("getting the SARIF output type when there is no `@kind` metadata", (t) => {
    const queryMetadata = {};
    const compatibleQueryKinds = [
        "Problem",
        "PathProblem",
        "Table",
        "Diagnostic",
    ];
    t.is((0, codeql_1.getSarifOutputType)(queryMetadata, compatibleQueryKinds), undefined);
});
test("getting the SARIF output type when the `@kind` metadata is not compatible with output", (t) => {
    const queryMetadata = {
        kind: "path-problem",
    };
    const compatibleQueryKinds = ["Problem", "Table", "Diagnostic"];
    t.is((0, codeql_1.getSarifOutputType)(queryMetadata, compatibleQueryKinds), undefined);
});
test("getting the SARIF output type when the `@kind` metadata is compatible with output", (t) => {
    const queryMetadata = {
        kind: "problem",
    };
    const compatibleQueryKinds = [
        "Problem",
        "PathProblem",
        "Table",
        "Diagnostic",
    ];
    t.is((0, codeql_1.getSarifOutputType)(queryMetadata, compatibleQueryKinds), "problem");
});
//# sourceMappingURL=codeql.test.js.map