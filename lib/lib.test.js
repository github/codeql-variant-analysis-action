"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const exec_1 = require("@actions/exec");
const io = __importStar(require("@actions/io"));
const archiver_1 = __importDefault(require("archiver"));
const ava_1 = __importDefault(require("ava"));
const lib_1 = require("./lib");
ava_1.default("unbundle creates a stable directory name", async (t) => {
    const tmpDir = fs_1.default.mkdtempSync("tmp");
    const cwd = process.cwd();
    process.chdir(tmpDir);
    try {
        const testText = "hello world";
        const dbFile = "example.zip";
        const output = fs_1.default.createWriteStream(dbFile);
        const archive = archiver_1.default("zip");
        archive.pipe(output);
        archive.append(testText, { name: "original-database-name/file.txt" });
        await archive.finalize();
        await lib_1.unbundleDatabase(dbFile);
        t.is(fs_1.default.readFileSync(path_1.default.join("database", "file.txt"), "utf-8"), testText);
    }
    finally {
        process.chdir(cwd);
        await io.rmRF(tmpDir);
    }
});
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
            dbDir
        ]);
        await lib_1.runQuery("codeql", "javascript", dbDir, "import javascript\nfrom File f select f", "a/b");
        t.true(fs_1.default
            .readFileSync(path_1.default.join("results", "results.md"), "utf-8")
            .includes(testFile));
        t.true(fs_1.default.existsSync(path_1.default.join("results", "results.bqrs")));
        t.true(fs_1.default.existsSync(path_1.default.join("results", "results.csv")));
    }
    finally {
        process.chdir(cwd);
        await io.rmRF(tmpDir);
    }
});
//# sourceMappingURL=lib.test.js.map