import Ajv, { ValidateFunction } from "ajv";

import { BQRSInfo, ResolvedQueries, Sarif } from "./codeql";
import { Instructions, RepoArray } from "./inputs";
import BQRSInfoSchema from "./json-schemas/BQRSInfo.json";
import instructionsSchema from "./json-schemas/Instructions.json";
import queryRunMetadataSchema from "./json-schemas/QueryRunMetadata.json";
import repoArraySchema from "./json-schemas/RepoArray.json";
import ResolvedQueriesSchema from "./json-schemas/ResolvedQueries.json";
import sarifSchema from "./json-schemas/Sarif.json";
import { QueryRunMetadata } from "./query-run-metadata";

type SchemaTypes = {
  repoArray: RepoArray;
  instructions: Instructions;
  sarif: Sarif;
  bqrsInfo: BQRSInfo;
  resolvedQueries: ResolvedQueries;
  queryRunMetadata: QueryRunMetadata;
};
export type Schema = keyof SchemaTypes;

const ajv = new Ajv();
const validators: Record<Schema, ValidateFunction> = {
  repoArray: ajv.compile(repoArraySchema),
  instructions: ajv.compile(instructionsSchema),
  sarif: ajv.compile(sarifSchema),
  bqrsInfo: ajv.compile(BQRSInfoSchema),
  resolvedQueries: ajv.compile(ResolvedQueriesSchema),
  queryRunMetadata: ajv.compile(queryRunMetadataSchema),
};
export const schemaNames = Object.keys(validators) as Schema[];

export function validateObject<T extends Schema>(
  obj: unknown,
  schema: T
): SchemaTypes[T] {
  const validator = validators[schema];
  if (!validator(obj)) {
    throw new Error(
      `Object does not match the "${schema}" schema: ${ajv.errorsText(
        validator.errors
      )}`
    );
  }
  return obj as SchemaTypes[T];
}
