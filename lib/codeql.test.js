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
    }
    finally {
        process.chdir(cwd);
        await (0, io_1.rmRF)(tmpDir);
    }
});
//# sourceMappingURL=codeql.test.js.map