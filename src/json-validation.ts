import * as fs from "fs";

import Ajv from "ajv";

type Schema = "RepoArray" | "Instructions";

export function validateObject<T>(obj: unknown, schema: Schema): T {
  const schemaContents = fs.readFileSync(
    `${__dirname}/../src/json-schemas/${schema}.json`
  );
  const ajv = new Ajv();
  const validate = ajv.compile(schemaContents);
  const valid = validate(obj);
  if (!valid) {
    throw new Error(
      `Object does not match the "${schema}" schema: ${validate.errors}`
    );
  }
  return obj as T;
}
