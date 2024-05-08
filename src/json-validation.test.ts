import {
  BQRSInfo,
  QueryMetadata,
  ResolvedDatabase,
  ResolvedQueries,
  Sarif,
} from "./codeql";
import { Policy, RepoTask } from "./gh-api-client";
import { Instructions, RepoArray } from "./inputs";
import {
  SchemaValidationError,
  schemaNames,
  validateObject,
} from "./json-validation";

describe("validateObject", () => {
  for (const schema of schemaNames) {
    it(`throws error for invalid ${schema}`, () => {
      const testObj = {
        trash: true,
        kind: 123,
      };
      expect(() => validateObject(testObj, schema)).toThrow(
        SchemaValidationError,
      );
    });
  }

  it("can successfully validate RepoArray", () => {
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
    expect(() => validateObject(obj, "repoArray")).not.toThrow();
  });

  it("can successfully validate Instructions", () => {
    const obj: Instructions = {
      repositories: [
        {
          id: 123,
          nwo: "a/b",
        },
      ],
    };
    expect(() => validateObject(obj, "instructions")).not.toThrow();
  });

  it("can successfully validate Sarif", () => {
    const obj: Sarif = {
      runs: [
        {
          results: [],
        },
      ],
    };
    expect(() => validateObject(obj, "sarif")).not.toThrow();
  });

  it("can successfully validate BQRSInfo", () => {
    const obj: BQRSInfo = {
      resultSets: [
        {
          name: "aaa",
          rows: 13,
        },
      ],
      compatibleQueryKinds: ["problem"],
    };
    expect(() => validateObject(obj, "bqrsInfo")).not.toThrow();
  });

  it("can successfully validate ResolvedQueries", () => {
    const obj: ResolvedQueries = ["foo"];
    expect(() => validateObject(obj, "resolvedQueries")).not.toThrow();
  });

  it("can successfully validate ResolvedDatabase", () => {
    const obj: ResolvedDatabase = {
      sourceLocationPrefix: "foo",
    };
    expect(() => validateObject(obj, "resolvedDatabase")).not.toThrow();
  });

  it("can successfully validate QueryMetadata", () => {
    const obj: QueryMetadata = {
      kind: "problem",
    };
    expect(() => validateObject(obj, "queryMetadata")).not.toThrow();
  });

  it("can successfully validate RepoTask", () => {
    /* eslint-disable @typescript-eslint/naming-convention */
    const obj: RepoTask = {
      analysis_status: "pending",
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    expect(() => validateObject(obj, "repoTask")).not.toThrow();
  });

  it("can successfully validate Policy", () => {
    /* eslint-disable @typescript-eslint/naming-convention */
    const obj: Policy = {
      upload_url: "https://example.com",
      header: {
        foo: "bar",
      },
      form: {
        baz: "qux",
      },
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    expect(() => validateObject(obj, "policy")).not.toThrow();
  });
});
