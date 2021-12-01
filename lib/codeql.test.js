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
ava_1.default.before(async (t) => {
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
ava_1.default.after(async (t) => {
    var _a;
    if (((_a = t.context) === null || _a === void 0 ? void 0 : _a.tmpDir) !== undefined) {
        await (0, io_1.rmRF)(t.context.tmpDir);
    }
});
(0, ava_1.default)("running a basic query", async (t) => {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    const cwd = process.cwd();
    process.chdir(tmpDir);
    try {
        await (0, codeql_1.runQuery)("codeql", "javascript", t.context.db, "a/b", "import javascript\nfrom File f select f");
        t.true(fs_1.default
            .readFileSync(path_1.default.join("results", "results.md"), "utf-8")
            .includes("test.js"));
        t.true(fs_1.default.existsSync(path_1.default.join("results", "results.bqrs")));
        t.true(fs_1.default.existsSync(path_1.default.join("results", "results.csv")));
    }
    finally {
        process.chdir(cwd);
        await (0, io_1.rmRF)(tmpDir);
    }
});
(0, ava_1.default)("running a query in a pack", async (t) => {
    const testPack = path_1.default.resolve("testdata/test_pack");
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    const cwd = process.cwd();
    process.chdir(tmpDir);
    try {
        await (0, codeql_1.runQuery)("codeql", "javascript", t.context.db, "a/b", undefined, testPack);
        t.true(fs_1.default
            .readFileSync(path_1.default.join("results", "results.md"), "utf-8")
            .includes("| 0 | 1 |"));
        t.true(fs_1.default.existsSync(path_1.default.join("results", "results.bqrs")));
        t.true(fs_1.default.existsSync(path_1.default.join("results", "results.csv")));
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
(0, ava_1.default)("getting the commit SHA from a database", async (t) => {
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
        t.is((0, codeql_1.getDatabaseSHA)(tmpDir), "ccf1e13626d97b009b4da78f719f028d9f7cdf80");
    }
    finally {
        await (0, io_1.rmRF)(tmpDir);
    }
});
(0, ava_1.default)("getting the commit SHA when codeql-database.yml exists, but does not contain SHA", async (t) => {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    try {
        fs_1.default.writeFileSync(path_1.default.join(tmpDir, "codeql-database.yml"), `---
sourceLocationPrefix: "hello-world"
baselineLinesOfCode: 17442
unicodeNewlines: true
columnKind: "utf16"
primaryLanguage: "javascript"
`);
        t.is((0, codeql_1.getDatabaseSHA)(tmpDir), "HEAD");
    }
    finally {
        await (0, io_1.rmRF)(tmpDir);
    }
});
(0, ava_1.default)("getting the commit SHA when codeql-database.yml exists, but is invalid", async (t) => {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    try {
        fs_1.default.writeFileSync(path_1.default.join(tmpDir, "codeql-database.yml"), `    foo:"
bar
`);
        t.is((0, codeql_1.getDatabaseSHA)(tmpDir), "HEAD");
    }
    finally {
        await (0, io_1.rmRF)(tmpDir);
    }
});
(0, ava_1.default)("getting the commit SHA when the codeql-database.yml does not exist", async (t) => {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    try {
        t.is((0, codeql_1.getDatabaseSHA)(tmpDir), "HEAD");
    }
    finally {
        await (0, io_1.rmRF)(tmpDir);
    }
});
(0, ava_1.default)("reading the metadata for a real database", async (t) => {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    const cwd = process.cwd();
    process.chdir(tmpDir);
    try {
        // Test the real database, which has no commit SHA (until CodeQL CLI 2.7.2 is released).
        // TODO: update this test once CodeQL CLI 2.7.2 is released.
        await (0, exec_1.exec)("codeql", [
            "database",
            "unbundle",
            t.context.db,
            "--name=realDb",
        ]);
        const sha2 = (0, codeql_1.getDatabaseSHA)("realDb");
        t.is(sha2, "HEAD");
    }
    finally {
        process.chdir(cwd);
        await (0, io_1.rmRF)(tmpDir);
    }
});
(0, ava_1.default)("creating a result index", async (t) => {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    const cwd = process.cwd();
    process.chdir(tmpDir);
    try {
        const output = await (0, codeql_1.runQuery)("codeql", "javascript", t.context.db, "a/b", "import javascript\nfrom File f\nwhere exists(f.getRelativePath())\nselect f");
        const outputDir = path_1.default.dirname(output[0]); // We know that all output files are in the same directory.
        const downloadResponse = {
            artifactName: "results",
            downloadPath: outputDir,
        };
        const result = await (0, interpret_1.createResultIndex)([downloadResponse]);
        t.is(result.length, 1);
        t.is(result[0].nwo, "a/b");
        t.is(result[0].id, "results");
        t.is(result[0].results_count, 1);
        t.true(result[0].bqrs_file_size > 0);
    }
    finally {
        process.chdir(cwd);
        await (0, io_1.rmRF)(tmpDir);
    }
});
(0, ava_1.default)("getting the default query from a pack", async (t) => {
    t.is(await (0, codeql_1.getRemoteQueryPackDefaultQuery)("codeql", "testdata/test_pack"), path_1.default.resolve("testdata/test_pack/x/query.ql"));
});
//# sourceMappingURL=codeql.test.js.map