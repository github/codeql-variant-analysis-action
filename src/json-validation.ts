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
const validators: Record<Schema, () => ValidateFunction> = {
  repoArray: memoize(() => ajv.compile(repoArraySchema)),
  instructions: memoize(() => ajv.compile(instructionsSchema)),
};
export const schemaNames = Object.keys(validators) as Schema[];

function memoize<T>(generator: () => T): () => T {
  let schema: T | undefined = undefined;
  return () => {
    return (schema = schema ?? generator());
  };
}

export function validateObject<T extends keyof SchemaTypes>(
  obj: unknown,
  schema: T
): SchemaTypes[T] {
  const validator = validators[schema]();
  if (!validator(obj)) {
    for (const error of validator.errors || []) {
      console.error(error.message);
    }
    throw new Error(`Object does not match the "${schema}" schema`);
  }
  return obj as SchemaTypes[T];
}
