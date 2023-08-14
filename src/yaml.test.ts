import test from "ava";

import { parseYaml } from "./yaml";

test("can successfully parse YAML", (t) => {
  t.deepEqual(
    {
      sourceLocationPrefix: "/home/runner/work/bulk-builder/bulk-builder",
      baselineLinesOfCode: 13088,
      unicodeNewlines: false,
      columnKind: "utf16",
      primaryLanguage: "java",
      finalised: true,
    },
    parseYaml(`---
sourceLocationPrefix: /home/runner/work/bulk-builder/bulk-builder
baselineLinesOfCode: 13088
unicodeNewlines: false
columnKind: utf16
primaryLanguage: java
finalised: true
`)
  );
});
