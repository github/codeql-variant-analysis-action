import test from "ava";

import { parseYaml } from "./yaml";

test("can successfully parse YAML with potentially exponential commit SHA", (t) => {
  t.deepEqual(
    {
      sourceLocationPrefix: "/home/runner/work/bulk-builder/bulk-builder",
      baselineLinesOfCode: 13088,
      unicodeNewlines: false,
      columnKind: "utf16",
      primaryLanguage: "java",
      creationMetadata: {
        sha: "4225332178759948e04347560002921719079454",
        cliVersion: "2.14.1",
        creationTime: "2023-08-03T18:19:44.622274245Z",
      },
      finalised: true,
    },
    parseYaml(`---
sourceLocationPrefix: /home/runner/work/bulk-builder/bulk-builder
baselineLinesOfCode: 13088
unicodeNewlines: false
columnKind: utf16
primaryLanguage: java
creationMetadata:
  sha: 4225332178759948e04347560002921719079454
  cliVersion: 2.14.1
  creationTime: 2023-08-03T18:19:44.622274245Z
finalised: true
`)
  );
});

test("can successfully parse YAML with numeric commit SHA", (t) => {
  t.deepEqual(
    {
      sourceLocationPrefix: "/home/runner/work/bulk-builder/bulk-builder",
      baselineLinesOfCode: 13088,
      unicodeNewlines: false,
      columnKind: "utf16",
      primaryLanguage: "java",
      creationMetadata: {
        sha: "4225332178759948504347560002921719079454",
        cliVersion: "2.14.1",
        creationTime: "2023-08-03T18:19:44.622274245Z",
      },
      finalised: true,
    },
    parseYaml(`---
sourceLocationPrefix: /home/runner/work/bulk-builder/bulk-builder
baselineLinesOfCode: 13088
unicodeNewlines: false
columnKind: utf16
primaryLanguage: java
creationMetadata:
  sha: 4225332178759948504347560002921719079454
  cliVersion: 2.14.1
  creationTime: 2023-08-03T18:19:44.622274245Z
finalised: true
`)
  );
});
