import test from "ava";

import { toS } from "./interpret";

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

test("relative URL conversion", (t) => {
  const select = results["#select"];
  const input = select.tuples[0][0];
  const result = toS(
    input,
    "dsp-testing/qc-demo-github-certstore",
    "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore"
  );

  t.is(
    "[CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/HEAD/certstore_linux.go#L8)",
    result
  );
});

test("absolute URL left alone", (t) => {
  const select = results["#select"];
  const input = select.tuples[0][0];
  const result = toS(input, "dsp-testing/qc-demo-github-certstore", "/tmp");

  t.is(
    "[CERTSTORE_DOESNT_WORK_ON_LINIX](file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go#L8)",
    result
  );
});
