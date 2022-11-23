"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = __importDefault(require("ava"));
const json_validation_1 = require("./json-validation");
const test = ava_1.default;
for (const schema of json_validation_1.schemaNames) {
    test(`throws error for invalid ${schema}`, (t) => {
        const obj = JSON.parse(JSON.stringify({
            trash: true,
        }));
        const error = t.throws(() => (0, json_validation_1.validateObject)(obj, schema));
        t.deepEqual(error.message, `Object does not match the "${schema}" schema`);
    });
}
test("can successfully validate RepoArray", (t) => {
    const obj = [
        {
            id: 123,
            nwo: "a/b",
        },
        {
            id: 456,
            nwo: "c/d",
            downloadUrl: "https://example.com",
        },
        {
            id: 789,
            nwo: "e/f",
            pat: "abcdef",
        },
    ];
    t.notThrows(() => (0, json_validation_1.validateObject)(obj, "repoArray"));
});
test("can successfully validate Instructions", (t) => {
    const obj = {
        repositories: [
            {
                id: 123,
                nwo: "a/b",
            },
        ],
    };
    t.notThrows(() => (0, json_validation_1.validateObject)(obj, "instructions"));
});
//# sourceMappingURL=json-validation.test.js.map