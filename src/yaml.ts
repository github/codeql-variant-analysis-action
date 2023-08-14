import fs from "fs";

import * as yaml from "js-yaml";

export function parseYaml<T>(src: string): T {
  return yaml.load(src) as T;
}

export function parseYamlFromFile<T>(filePath: string): T {
  return parseYaml(fs.readFileSync(filePath, "utf8"));
}
