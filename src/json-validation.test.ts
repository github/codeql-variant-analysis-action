import test from "ava";

import { BQRSInfo, Sarif } from "./codeql";
import { Instructions, RepoArray } from "./inputs";
import { schemaNames, validateObject } from "./json-validation";
import { QueryRunMetadata } from "./query-run-metadata";

for (const schema of schemaNames) {
  test(`throws error for invalid ${schema}`, (t) => {
    const obj = JSON.parse(
      JSON.stringify({
        trash: true,
      })
    );
    const error = t.throws(() => validateObject(obj, schema));
    t.assert(
      error.message.startsWith(`Object does not match the "${schema}" schema:`),
      `Error message is incorrect: "${error.message}"`
    );
  });
}

test("can successfully validate RepoArray", (t) => {
  const obj: RepoArray = [
    {
      id: 123,
      nwo: "a/b",
    },
    {
      id: 456,
      nwo: "c/d",
      downloadUrl: "https://example.com",
    },
    {
      id: 789,
      nwo: "e/f",
      pat: "abcdef",
    },
  ];
  t.notThrows(() => validateObject(obj, "repoArray"));
});

test("can successfully validate Instructions", (t) => {
  const obj: Instructions = {
    repositories: [
      {
        id: 123,
        nwo: "a/b",
      },
    ],
  };
  t.notThrows(() => validateObject(obj, "instructions"));
});

test("can successfully validate Sarif", (t) => {
  const obj: Sarif = {
    runs: [
      {
        results: [],
      },
    ],
  };
  t.notThrows(() => validateObject(obj, "sarif"));
});

test("can successfully validate BQRSInfo", (t) => {
  const obj: BQRSInfo = {
    resultSets: [
      {
        name: "aaa",
        rows: 13,
      },
    ],
    compatibleQueryKinds: ["problem"],
  };
  t.notThrows(() => validateObject(obj, "bqrsInfo"));
});

test("can successfully validate QueryRunMetadata", (t) => {
  const obj: QueryRunMetadata = {
    nwo: "foo/bar",
    resultCount: 123,
    sha: "abc",
    sourceLocationPrefix: "/path",
  };
  t.notThrows(() => validateObject(obj, "queryRunMetadata"));
});
