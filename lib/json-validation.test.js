"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = __importDefault(require("ava"));
const json_validation_1 = require("./json-validation");
for (const schema of json_validation_1.schemaNames) {
    (0, ava_1.default)(`throws error for invalid ${schema}`, (t) => {
        const obj = JSON.parse(JSON.stringify({
            trash: true,
        }));
        const error = t.throws(() => (0, json_validation_1.validateObject)(obj, schema));
        t.assert(error.message.startsWith(`Object does not match the "${schema}" schema:`), `Error message is incorrect: "${error.message}"`);
    });
}
(0, ava_1.default)("can successfully validate RepoArray", (t) => {
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
(0, ava_1.default)("can successfully validate Instructions", (t) => {
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