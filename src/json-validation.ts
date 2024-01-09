import Ajv, { ValidateFunction } from "ajv";

import {
  BQRSInfo,
  QueryMetadata,
  ResolvedDatabase,
  ResolvedQueries,
  Sarif,
} from "./codeql";
import { Policy, RepoTask } from "./gh-api-client";
import { Instructions, RepoArray } from "./inputs";
import BQRSInfoSchema from "./json-schemas/BQRSInfo.json";
import instructionsSchema from "./json-schemas/Instructions.json";
import policySchema from "./json-schemas/Policy.json";
import queryMetadataSchema from "./json-schemas/QueryMetadata.json";
import repoArraySchema from "./json-schemas/RepoArray.json";
import repoTaskSchema from "./json-schemas/RepoTask.json";
import ResolvedDatabaseSchema from "./json-schemas/ResolvedDatabase.json";
import ResolvedQueriesSchema from "./json-schemas/ResolvedQueries.json";
import sarifSchema from "./json-schemas/Sarif.json";

type SchemaTypes = {
  repoArray: RepoArray;
  instructions: Instructions;
  sarif: Sarif;
  bqrsInfo: BQRSInfo;
  resolvedQueries: ResolvedQueries;
  resolvedDatabase: ResolvedDatabase;
  queryMetadata: QueryMetadata;
  repoTask: RepoTask;
  policy: Policy;
};
type Schema = keyof SchemaTypes;

const ajv = new Ajv();
const validators: Record<Schema, ValidateFunction> = {
  repoArray: ajv.compile(repoArraySchema),
  instructions: ajv.compile(instructionsSchema),
  sarif: ajv.compile(sarifSchema),
  bqrsInfo: ajv.compile(BQRSInfoSchema),
  resolvedQueries: ajv.compile(ResolvedQueriesSchema),
  resolvedDatabase: ajv.compile(ResolvedDatabaseSchema),
  queryMetadata: ajv.compile(queryMetadataSchema),
  repoTask: ajv.compile(repoTaskSchema),
  policy: ajv.compile(policySchema),
};
export const schemaNames = Object.keys(validators) as Schema[];

export function validateObject<T extends Schema>(
  obj: unknown,
  schema: T,
): SchemaTypes[T] {
  const validator = validators[schema];
  if (!validator(obj)) {
    throw new Error(
      `Object does not match the "${schema}" schema: ${ajv.errorsText(
        validator.errors,
      )}`,
    );
  }
  return obj as SchemaTypes[T];
}
