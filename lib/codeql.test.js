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
ava_1.default("running a basic query", async (t) => {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    const cwd = process.cwd();
    process.chdir(tmpDir);
    try {
        const projectDir = "project";
        const dbDir = "db";
        fs_1.default.mkdirSync(projectDir);
        const testFile = path_1.default.join(projectDir, "test.js");
        fs_1.default.writeFileSync(testFile, "const x = 1;");
        await exec_1.exec("codeql", [
            "database",
            "create",
            "--language=javascript",
            `--source-root=${projectDir}`,
            dbDir,
        ]);
        await exec_1.exec("codeql", [
            "database",
            "bundle",
            "--output=database.zip",
            dbDir,
        ]);
        await codeql_1.runQuery("codeql", "javascript", "database.zip", "import javascript\nfrom File f select f", "a/b");
        t.true(fs_1.default
            .readFileSync(path_1.default.join("results", "results.md"), "utf-8")
            .includes(testFile));
        t.true(fs_1.default.existsSync(path_1.default.join("results", "results.bqrs")));
        t.true(fs_1.default.existsSync(path_1.default.join("results", "results.csv")));
    }
    finally {
        process.chdir(cwd);
        await io_1.rmRF(tmpDir);
    }
});
//# sourceMappingURL=codeql.test.js.map