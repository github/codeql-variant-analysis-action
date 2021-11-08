"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const ava_1 = __importDefault(require("ava"));
const interpret_1 = require("./interpret");
const rawResults = JSON.parse(`{
    "#select": {
      "columns": [
        {
          "name": "e",
          "kind": "Entity"
        },
        {
          "kind": "String"
        },
        {
          "kind": "String"
        }
      ],
      "tuples": [
        [
          {
            "id": 7661,
            "label": "CERTSTORE_DOESNT_WORK_ON_LINIX",
            "url": {
              "uri": "file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go",
              "startLine": 8,
              "startColumn": 2,
              "endLine": 8,
              "endColumn": 31
            }
          },
          "This expression has no effect.",
          "This is another string field."
        ]
      ]
    }
  }`);
const rawWindowsResults = JSON.parse(`{
  "#select": {
    "columns": [
      {
        "name": "f",
        "kind": "Entity"
      },
      {
        "kind": "String"
      },
      {
        "kind": "String"
      }
    ],
    "tuples": [
      [
        {
          "id": 1730354,
          "label": "D:/a/test-electron/test-electron/vsts-arm64v8.yml",
          "url": {
            "uri": "file:/D:/a/test-electron/test-electron/vsts-arm64v8.yml",
            "startLine": 0,
            "startColumn": 0,
            "endLine": 0,
            "endColumn": 0
          }
        },
        "D:/a/test-electron/test-electron/vsts-arm64v8.yml",
        "This is another string field."
      ]
    ]
  }
}`);
const problemResults = JSON.parse(`{
  "#select": {
    "columns": [
      {
        "kind": "Entity"
      },
      {
        "kind": "String"
      },
      {
        "kind": "Entity"
      },
      {
        "kind": "String"
      }
    ],
    "tuples": [
      [
        {
          "id": 233013,
          "label": "req.url!",
          "url": {
            "uri": "file:/home/runner/work/test-electron/test-electron/spec-main/api-session-spec.ts",
            "startLine": 940,
            "startColumn": 19,
            "endLine": 940,
            "endColumn": 26
          }
        },
        "This path depends on $@.",
        {
          "id": 233014,
          "label": "req.url",
          "url": {
            "uri": "file:/home/runner/work/test-electron/test-electron/spec-main/api-session-spec.ts",
            "startLine": 940,
            "startColumn": 19,
            "endLine": 940,
            "endColumn": 25
          }
        },
        "a user-provided value"
      ]
    ]
  }
}`);
(0, ava_1.default)("relative URL conversion", (t) => {
    const result = (0, interpret_1.entityToString)(rawResults["#select"].tuples[0][0], "dsp-testing/qc-demo-github-certstore", "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore", "mybranch");
    t.is("[CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8)", result);
});
(0, ava_1.default)("absolute URL left alone", (t) => {
    const result = (0, interpret_1.entityToString)(rawResults["#select"].tuples[0][0], "dsp-testing/qc-demo-github-certstore", "/tmp", "HEAD");
    t.is("[CERTSTORE_DOESNT_WORK_ON_LINIX](file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go#L8)", result);
});
(0, ava_1.default)("table row formatted correctly", (t) => {
    const result = (0, interpret_1.toTableRow)([
        "[CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8)",
        "This expression has no effect.",
    ]);
    t.is("| [CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8) | This expression has no effect. |\n", result);
});
(0, ava_1.default)("problem query message with too few placeholder values", async (t) => {
    const tuple = [
        {
            id: 1234,
            label: "woo",
            url: {
                uri: "file:/home/runner/work/bar/bar/file.js",
                startLine: 1,
                startColumn: 2,
                endLine: 3,
                endColumn: 4,
            },
        },
        "This depends on $@ and $@ and $@.",
        {
            id: 1234,
            label: "woo",
            url: {
                uri: "file:/home/runner/work/bar/bar/A.js",
                startLine: 1,
                startColumn: 2,
                endLine: 3,
                endColumn: 4,
            },
        },
        "A",
        {
            id: 1234,
            label: "woo",
            url: {
                uri: "file:/home/runner/work/bar/bar/B.js",
                startLine: 1,
                startColumn: 2,
                endLine: 3,
                endColumn: 4,
            },
        },
        "B",
    ];
    const message = (0, interpret_1.problemQueryMessage)(tuple, "foo/bar", "/home/runner/work/bar/bar", "mybranch");
    t.is(message, "This depends on [A](https://github.com/foo/bar/blob/mybranch/A.js#L1) and [B](https://github.com/foo/bar/blob/mybranch/B.js#L1) and $@.");
});
(0, ava_1.default)("problem query message with too many placeholder values", async (t) => {
    const tuple = [
        {
            id: 1234,
            label: "woo",
            url: {
                uri: "file:/home/runner/work/bar/bar/file.js",
                startLine: 1,
                startColumn: 2,
                endLine: 3,
                endColumn: 4,
            },
        },
        "This depends on $@ and $@.",
        {
            id: 1234,
            label: "woo",
            url: {
                uri: "file:/home/runner/work/bar/bar/A.js",
                startLine: 1,
                startColumn: 2,
                endLine: 3,
                endColumn: 4,
            },
        },
        "A",
        {
            id: 1234,
            label: "woo",
            url: {
                uri: "file:/home/runner/work/bar/bar/B.js",
                startLine: 1,
                startColumn: 2,
                endLine: 3,
                endColumn: 4,
            },
        },
        "B",
        {
            id: 1234,
            label: "woo",
            url: {
                uri: "file:/home/runner/work/bar/bar/C.js",
                startLine: 1,
                startColumn: 2,
                endLine: 3,
                endColumn: 4,
            },
        },
        "C",
    ];
    const message = (0, interpret_1.problemQueryMessage)(tuple, "foo/bar", "/home/runner/work/bar/bar", "mybranch");
    t.is(message, "This depends on [A](https://github.com/foo/bar/blob/mybranch/A.js#L1) and [B](https://github.com/foo/bar/blob/mybranch/B.js#L1).");
});
(0, ava_1.default)("problem query message with placeholder messages containing $@", async (t) => {
    const tuple = [
        {
            id: 1234,
            label: "woo",
            url: {
                uri: "file:/home/runner/work/bar/bar/file.js",
                startLine: 1,
                startColumn: 2,
                endLine: 3,
                endColumn: 4,
            },
        },
        "This depends on $@ and $@.",
        {
            id: 1234,
            label: "woo",
            url: {
                uri: "file:/home/runner/work/bar/bar/A.js",
                startLine: 1,
                startColumn: 2,
                endLine: 3,
                endColumn: 4,
            },
        },
        "another $@ value",
        {
            id: 1234,
            label: "woo",
            url: {
                uri: "file:/home/runner/work/bar/bar/B.js",
                startLine: 1,
                startColumn: 2,
                endLine: 3,
                endColumn: 4,
            },
        },
        "B",
    ];
    const message = (0, interpret_1.problemQueryMessage)(tuple, "foo/bar", "/home/runner/work/bar/bar", "mybranch");
    t.is(message, "This depends on [another $@ value](https://github.com/foo/bar/blob/mybranch/A.js#L1) and [B](https://github.com/foo/bar/blob/mybranch/B.js#L1).");
});
(0, ava_1.default)("entire raw result set converted correctly", async (t) => {
    let output = "";
    const w = new stream_1.Stream.Writable({
        objectMode: true,
        write: (chunk, _, cb) => {
            output += chunk;
            cb();
        },
    });
    await (0, interpret_1.interpret)(w, rawResults, "dsp-testing/qc-demo-github-certstore", [], "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore", "mybranch");
    t.is(output, `## dsp-testing/qc-demo-github-certstore

| e | - | - |
| - | - | - |
| [CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8) | This expression has no effect. | This is another string field. |
`);
});
(0, ava_1.default)("windows results conversion", async (t) => {
    let output = "";
    const w = new stream_1.Stream.Writable({
        objectMode: true,
        write: (chunk, _, cb) => {
            output += chunk;
            cb();
        },
    });
    await (0, interpret_1.interpret)(w, rawWindowsResults, "dsp-testing/test-electron", [], "D:\\a\\test-electron\\test-electron", "mybranch");
    t.is(output, `## dsp-testing/test-electron

| f | - | - |
| - | - | - |
| [D:/a/test-electron/test-electron/vsts-arm64v8.yml](https://github.com/dsp-testing/test-electron/blob/mybranch/vsts-arm64v8.yml#L0) | D:/a/test-electron/test-electron/vsts-arm64v8.yml | This is another string field. |
`);
});
(0, ava_1.default)("problem result set converted correctly", async (t) => {
    let output = "";
    const w = new stream_1.Stream.Writable({
        objectMode: true,
        write: (chunk, _, cb) => {
            output += chunk;
            cb();
        },
    });
    await (0, interpret_1.interpret)(w, problemResults, "dsp-testing/test-electron", ["Problem"], "/home/runner/work/test-electron/test-electron", "mybranch");
    t.is(output, `## dsp-testing/test-electron

| - | Message |
| - | - |
| [req.url!](https://github.com/dsp-testing/test-electron/blob/mybranch/spec-main/api-session-spec.ts#L940) | This path depends on [a user-provided value](https://github.com/dsp-testing/test-electron/blob/mybranch/spec-main/api-session-spec.ts#L940). |
`);
});
//# sourceMappingURL=interpret.test.js.map