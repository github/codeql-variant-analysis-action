import { Stream } from "stream";

import test from "ava";

import {
  entityToString,
  toTableRow,
  problemQueryMessage,
  interpret,
} from "./interpret";

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

test("relative URL conversion", (t) => {
  const result = entityToString(
    rawResults["#select"].tuples[0][0],
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
  const result = entityToString(
    rawResults["#select"].tuples[0][0],
    "dsp-testing/qc-demo-github-certstore",
    "/tmp",
    "HEAD"
  );

  t.is(
    "[CERTSTORE_DOESNT_WORK_ON_LINIX](file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go#L8)",
    result
  );
});

test("table row formatted correctly", (t) => {
  const result = toTableRow([
    "[CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8)",
    "This expression has no effect.",
  ]);

  t.is(
    "| [CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8) | This expression has no effect. |\n",
    result
  );
});

test("problem query message with too few placeholder values", async (t) => {
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

  const message = problemQueryMessage(
    tuple,
    "foo/bar",
    "/home/runner/work/bar/bar",
    "mybranch"
  );

  t.is(
    message,
    "This depends on [A](https://github.com/foo/bar/blob/mybranch/A.js#L1) and [B](https://github.com/foo/bar/blob/mybranch/B.js#L1) and $@."
  );
});

test("problem query message with too many placeholder values", async (t) => {
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

  const message = problemQueryMessage(
    tuple,
    "foo/bar",
    "/home/runner/work/bar/bar",
    "mybranch"
  );

  t.is(
    message,
    "This depends on [A](https://github.com/foo/bar/blob/mybranch/A.js#L1) and [B](https://github.com/foo/bar/blob/mybranch/B.js#L1)."
  );
});

test("problem query message with placeholder messages containing $@", async (t) => {
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

  const message = problemQueryMessage(
    tuple,
    "foo/bar",
    "/home/runner/work/bar/bar",
    "mybranch"
  );

  t.is(
    message,
    "This depends on [another $@ value](https://github.com/foo/bar/blob/mybranch/A.js#L1) and [B](https://github.com/foo/bar/blob/mybranch/B.js#L1)."
  );
});

test("entire raw result set converted correctly", async (t) => {
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
    rawResults,
    "dsp-testing/qc-demo-github-certstore",
    [],
    "/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore",
    "mybranch"
  );

  t.is(
    output,
    `## dsp-testing/qc-demo-github-certstore

| e | - | - |
| - | - | - |
| [CERTSTORE_DOESNT_WORK_ON_LINIX](https://github.com/dsp-testing/qc-demo-github-certstore/blob/mybranch/certstore_linux.go#L8) | This expression has no effect. | This is another string field. |
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
    rawWindowsResults,
    "dsp-testing/test-electron",
    [],
    "D:\\a\\test-electron\\test-electron",
    "mybranch"
  );

  t.is(
    output,
    `## dsp-testing/test-electron

| f | - | - |
| - | - | - |
| [D:/a/test-electron/test-electron/vsts-arm64v8.yml](https://github.com/dsp-testing/test-electron/blob/mybranch/vsts-arm64v8.yml#L0) | D:/a/test-electron/test-electron/vsts-arm64v8.yml | This is another string field. |
`
  );
});

test("problem result set converted correctly", async (t) => {
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
    problemResults,
    "dsp-testing/test-electron",
    ["Problem"],
    "/home/runner/work/test-electron/test-electron",
    "mybranch"
  );

  t.is(
    output,
    `## dsp-testing/test-electron

| - | Message |
| - | - |
| [req.url!](https://github.com/dsp-testing/test-electron/blob/mybranch/spec-main/api-session-spec.ts#L940) | This path depends on [a user-provided value](https://github.com/dsp-testing/test-electron/blob/mybranch/spec-main/api-session-spec.ts#L940). |
`
  );
});
