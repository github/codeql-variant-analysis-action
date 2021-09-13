import { Stream } from "stream";

import test from "ava";

import { toS, toMd, interpret } from "./interpret";

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

const windowsResults = JSON.parse(`{
  "#select": {
    "columns": [
      {
        "name": "f",
        "kind": "Entity"
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
        "D:/a/test-electron/test-electron/vsts-arm64v8.yml"
      ]
    ]
  }
}`);

test("relative URL conversion", (t) => {
  const result = toS(
    results["#select"].tuples[0][0],
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
  const result = toS(
    results["#select"].tuples[0][0],
    "dsp-testing/qc-demo-github-certstore",
    "/tmp"
  );

  t.is(
    "[CERTSTORE_DOESNT_WORK_ON_LINIX](file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go#L8)",
    result
  );
});

test("entire row converted correctly", (t) => {
  const result = toMd(
    results["#select"].tuples[0],
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

test("windows results conversion", async (t) => {
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
    windowsResults,
    "dsp-testing/test-electron",
    "D:\\a\\test-electron\\test-electron",
    "mybranch"
  );

  t.is(
    output,
    `## dsp-testing/test-electron

| f | - |
| - | - |
| [D:/a/test-electron/test-electron/vsts-arm64v8.yml](https://github.com/dsp-testing/test-electron/blob/mybranch/vsts-arm64v8.yml#L0) | D:/a/test-electron/test-electron/vsts-arm64v8.yml |
`
  );
});
