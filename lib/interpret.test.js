"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
    const result = interpret_1.toS(input, "dsp-testing/qc-demo-github-certstore", "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore");
    t.is("[CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/HEAD/certstore_linux.go#L8)", result);
});
ava_1.default("absolute URL left alone", (t) => {
    const select = results["#select"];
    const input = select.tuples[0][0];
    const result = interpret_1.toS(input, "dsp-testing/qc-demo-github-certstore", "/tmp");
    t.is("[CERTSTORE_DOESNT_WORK_ON_LINIX](file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go#L8)", result);
});
//# sourceMappingURL=interpret.test.js.map