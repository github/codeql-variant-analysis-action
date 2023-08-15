import fs from "fs";

import { parse, ScalarTag } from "yaml";

// Use a custom tag for floats in exponential notation, to make the +/- mandatory
// This fixes commit SHAs consisting only of numbers with a single "e" in them
export const floatExp: ScalarTag = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+][0-9]+$/, // Change is here, making the [-+] mandatory
  resolve: (str: string) => parseFloat(str.replace(/_/g, "")),
  stringify(node) {
    const num = Number(node.value);
    if (isFinite(num)) {
      return num.toExponential();
    }

    return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
  },
};

export function parseYaml<T>(src: string): T {
  return parse(src, {
    version: "1.1", // CodeQL CLI uses YAML 1.1
    schema: "yaml-1.1",
    customTags: (tags) => {
      const tagsWithoutFloatExp = tags.filter((tag) => {
        if (typeof tag !== "object" || !tag.tag) {
          return true;
        }

        return tag.tag !== "tag:yaml.org,2002:float" && tag.format !== "EXP";
      });

      return [floatExp, ...tagsWithoutFloatExp];
    },
  }) as T;
}

export function parseYamlFromFile<T>(filePath: string): T {
  return parseYaml(fs.readFileSync(filePath, "utf8"));
}
