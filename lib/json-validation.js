"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateObject = exports.schemas = void 0;
const ajv_1 = __importDefault(require("ajv"));
const Instructions_json_1 = __importDefault(require("./json-schemas/Instructions.json"));
const RepoArray_json_1 = __importDefault(require("./json-schemas/RepoArray.json"));
exports.schemas = {
    repoArray: RepoArray_json_1.default,
    instructions: Instructions_json_1.default,
};
function validateObject(obj, schema) {
    const ajv = new ajv_1.default();
    const validate = ajv.compile(exports.schemas[schema]);
    if (!validate(obj)) {
        for (const error of validate.errors || []) {
            console.error(error.message);
        }
        throw new Error(`Object does not match the "${schema}" schema`);
    }
    return obj;
}
exports.validateObject = validateObject;
//# sourceMappingURL=json-validation.js.map