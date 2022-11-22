import * as fs from "fs";

import Ajv from "ajv";

export const ALL_SCHEMAS = ["RepoArray", "Instructions"] as const;
type Schema = typeof ALL_SCHEMAS[number];

export function validateObject<T>(obj: unknown, schema: Schema): T {
  const schemaContents = fs.readFileSync(
    `${__dirname}/../src/json-schemas/${schema}.json`
  );
  const ajv = new Ajv();
  const validate = ajv.compile<T>(schemaContents);
  if (!validate(obj)) {
    for (const error of validate.errors || []) {
      console.error(error.message);
    }
    throw new Error(`Object does not match the "${schema}" schema`);
  }
  return obj;
}
