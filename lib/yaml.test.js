"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = __importDefault(require("ava"));
const yaml_1 = require("./yaml");
(0, ava_1.default)("can successfully parse YAML with potentially exponential commit SHA", (t) => {
    t.deepEqual({
        sourceLocationPrefix: "/home/runner/work/bulk-builder/bulk-builder",
        baselineLinesOfCode: BigInt(13088),
        unicodeNewlines: false,
        columnKind: "utf16",
        primaryLanguage: "java",
        creationMetadata: {
            sha: "4225332178759948e04347560002921719079454",
            cliVersion: "2.14.1",
            creationTime: new Date("2023-08-03T18:19:44.622274245Z"),
        },
        finalised: true,
    }, (0, yaml_1.parseYaml)(`---
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
`));
});
(0, ava_1.default)("can successfully parse YAML with numeric commit SHA", (t) => {
    t.deepEqual({
        sourceLocationPrefix: "/home/runner/work/bulk-builder/bulk-builder",
        baselineLinesOfCode: BigInt(13088),
        unicodeNewlines: false,
        columnKind: "utf16",
        primaryLanguage: "java",
        creationMetadata: {
            sha: BigInt("4225332178759948504347560002921719079454"),
            cliVersion: "2.14.1",
            creationTime: new Date("2023-08-03T18:19:44.622274245Z"),
        },
        finalised: true,
    }, (0, yaml_1.parseYaml)(`---
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
`));
});
//# sourceMappingURL=yaml.test.js.map