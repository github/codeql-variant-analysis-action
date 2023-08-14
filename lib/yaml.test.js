"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = __importDefault(require("ava"));
const yaml_1 = require("./yaml");
(0, ava_1.default)("can successfully parse YAML", (t) => {
    t.deepEqual({
        sourceLocationPrefix: "/home/runner/work/bulk-builder/bulk-builder",
        baselineLinesOfCode: 13088,
        unicodeNewlines: false,
        columnKind: "utf16",
        primaryLanguage: "java",
        finalised: true,
    }, (0, yaml_1.parseYaml)(`---
sourceLocationPrefix: /home/runner/work/bulk-builder/bulk-builder
baselineLinesOfCode: 13088
unicodeNewlines: false
columnKind: utf16
primaryLanguage: java
finalised: true
`));
});
//# sourceMappingURL=yaml.test.js.map