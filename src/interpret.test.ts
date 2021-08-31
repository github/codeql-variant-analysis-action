import { Stream } from "stream";

import test from "ava";

import { toS, toMd, interpret } from "./interpret";
import { Convert } from "./json-result-generated";

const badResults = `{
  "#select": {}
}`;

const results = Convert.toJSONResult(`{

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

test("malformed result JSON throws error", (t) => {
  t.throws(() => Convert.toJSONResult(badResults));
});

test("relative URL conversion", (t) => {
  const select = results.select;
  const input = select.tuples[0][0];
  const result = toS(
    input,
    "dsp-testing/qc-demo-github-certstore",
    "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore",
    "mybranch"
  );

  t.is(
    "[CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8)",
    result
  );
});

test("absolute URL left alone", (t) => {
  const select = results.select;
  const input = select.tuples[0][0];
  const result = toS(input, "dsp-testing/qc-demo-github-certstore", "/tmp");

  t.is(
    "[CERTSTORE_DOESNT_WORK_ON_LINIX](file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go#L8)",
    result
  );
});

test("entire row converted correctly", (t) => {
  const select = results.select;
  const input = select.tuples[0];
  const result = toMd(
    input,
    "dsp-testing/qc-demo-github-certstore",
    "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore",
    "mybranch"
  );

  t.is(
    "| [CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8) | This expression has no effect. |\n",
    result
  );
});

test("entire result set converted correctly", async (t) => {
  let output = "";
  const w = new Stream.Writable({
    objectMode: true,
    write: (chunk, _, cb) => {
      output += chunk;
      cb();
    },
  });

  await interpret(
    w,
    results,
    "dsp-testing/qc-demo-github-certstore",
    "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore",
    "mybranch"
  );

  t.is(
    output,
    `## dsp-testing/qc-demo-github-certstore

| e | - |
| - | - |
| [CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8) | This expression has no effect. |
`
  );
});
