import Ajv from "ajv";

import { Instructions, RepoArray } from "./inputs";
import instructionsSchema from "./json-schemas/Instructions.json";
import repoArraySchema from "./json-schemas/RepoArray.json";

type SchemaTypes = {
  repoArray: RepoArray;
  instructions: Instructions;
};
export type Schema = keyof SchemaTypes;

export const schemas: Record<Schema, any> = {
  repoArray: repoArraySchema,
  instructions: instructionsSchema,
};

export function validateObject<T>(obj: unknown, schema: Schema): T {
  const ajv = new Ajv();
  const validate = ajv.compile<T>(schemas[schema]);
  if (!validate(obj)) {
    for (const error of validate.errors || []) {
      console.error(error.message);
    }
    throw new Error(`Object does not match the "${schema}" schema`);
  }
  return obj;
}
