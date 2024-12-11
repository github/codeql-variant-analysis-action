import { join, relative, resolve } from "path";
import { exit } from "process";

import { analyzeTsConfig } from "ts-unused-exports";
import { Analysis } from "ts-unused-exports/lib/types";

function main() {
  const repositoryRoot = resolve(join(__dirname, ".."));

  let result: Analysis;

  try {
    result = analyzeTsConfig("tsconfig.json");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Failed to analyze tsconfig.json:", error.message);
    } else {
      console.error("Failed to analyze tsconfig.json:", error);
    }
    exit(1);
  }

  if (!result) {
    console.error("No result from analyzeTsConfig");
    exit(1);
  }

  let foundUnusedExports = false;

  for (const [filepath, exportNameAndLocations] of Object.entries(
    result.unusedExports,
  )) {
    const relativeFilepath = relative(repositoryRoot, filepath);

    foundUnusedExports = true;

    console.log(relativeFilepath);
    for (const exportNameAndLocation of exportNameAndLocations) {
      console.log(`    ${exportNameAndLocation.exportName}`);
    }
    console.log();
  }

  if (foundUnusedExports) {
    exit(1);
  }
}

main();
