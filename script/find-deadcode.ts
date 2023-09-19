import { join, relative, resolve } from "path";
import { exit } from "process";

import analyzeTsConfig from "ts-unused-exports";

function main() {
  const repositoryRoot = resolve(join(__dirname, ".."));

  const result = analyzeTsConfig("tsconfig.json");
  let foundUnusedExports = false;

  for (const [filepath, exportNameAndLocations] of Object.entries(result)) {
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
