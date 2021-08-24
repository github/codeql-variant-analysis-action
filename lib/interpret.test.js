"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const ava_1 = __importDefault(require("ava"));
const interpret_1 = require("./interpret");
const results = JSON.parse(`{
    "#select": {
      "columns": [
        {
          "name": "e",
          "kind": "Entity"
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
          "This expression has no effect."
        ]
      ]
    }
  }`);
ava_1.default("relative URL conversion", (t) => {
    const select = results["#select"];
    const input = select.tuples[0][0];
    const result = interpret_1.toS(input, "dsp-testing/qc-demo-github-certstore", "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore", "mybranch");
    t.is("[CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8)", result);
});
ava_1.default("absolute URL left alone", (t) => {
    const select = results["#select"];
    const input = select.tuples[0][0];
    const result = interpret_1.toS(input, "dsp-testing/qc-demo-github-certstore", "/tmp");
    t.is("[CERTSTORE_DOESNT_WORK_ON_LINIX](file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go#L8)", result);
});
ava_1.default("entire row converted correctly", (t) => {
    const select = results["#select"];
    const input = select.tuples[0];
    const result = interpret_1.toMd(input, "dsp-testing/qc-demo-github-certstore", "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore", "mybranch");
    t.is("| [CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8) | This expression has no effect. |\n", result);
});
ava_1.default("entire result set converted correctly", async (t) => {
    let output = "";
    const w = new stream_1.Stream.Writable({
        objectMode: true,
        write: (chunk, _, cb) => {
            output += chunk;
            cb();
        },
    });
    await interpret_1.interpret(w, results, "dsp-testing/qc-demo-github-certstore", "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore", "mybranch");
    t.is(output, `## dsp-testing/qc-demo-github-certstore

| e | - |
| - | - |
| [CERTSTORE_DOESNT_WORK_ON_LINIX](file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go#L8) | This expression has no effect. |
`);
});
//# sourceMappingURL=interpret.test.js.map