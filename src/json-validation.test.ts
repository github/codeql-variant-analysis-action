import anyTest, { TestInterface } from "ava";

import { Instructions, RepoArray } from "./inputs";
import { schemaNames, validateObject } from "./json-validation";

const test = anyTest as TestInterface<{ db: string; tmpDir: string }>;

for (const schema of schemaNames) {
  test(`throws error for invalid ${schema}`, (t) => {
    const obj = JSON.parse(
      JSON.stringify({
        trash: true,
      })
    );
    const error = t.throws(() => validateObject(obj, schema));
    t.deepEqual(error.message, `Object does not match the "${schema}" schema`);
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
