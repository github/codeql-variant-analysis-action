import Ajv, { ValidateFunction } from "ajv";

import { Instructions, RepoArray } from "./inputs";
import instructionsSchema from "./json-schemas/Instructions.json";
import repoArraySchema from "./json-schemas/RepoArray.json";

type SchemaTypes = {
  repoArray: RepoArray;
  instructions: Instructions;
};
export type Schema = keyof SchemaTypes;

const ajv = new Ajv();
const validators: Record<Schema, ValidateFunction> = {
  repoArray: ajv.compile(repoArraySchema),
  instructions: ajv.compile(instructionsSchema),
};
export const schemaNames = Object.keys(validators) as Schema[];

export function validateObject<T extends keyof SchemaTypes>(
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
