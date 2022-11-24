"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateObject = exports.schemaNames = void 0;
const ajv_1 = __importDefault(require("ajv"));
const Instructions_json_1 = __importDefault(require("./json-schemas/Instructions.json"));
const QueryRunMetadata_json_1 = __importDefault(require("./json-schemas/QueryRunMetadata.json"));
const RepoArray_json_1 = __importDefault(require("./json-schemas/RepoArray.json"));
const Sarif_json_1 = __importDefault(require("./json-schemas/Sarif.json"));
const ajv = new ajv_1.default();
const validators = {
    repoArray: ajv.compile(RepoArray_json_1.default),
    instructions: ajv.compile(Instructions_json_1.default),
    sarif: ajv.compile(Sarif_json_1.default),
    queryRunMetadata: ajv.compile(QueryRunMetadata_json_1.default),
};
exports.schemaNames = Object.keys(validators);
function validateObject(obj, schema) {
    const validator = validators[schema];
    if (!validator(obj)) {
        throw new Error(`Object does not match the "${schema}" schema: ${ajv.errorsText(validator.errors)}`);
    }
    return obj;
}
exports.validateObject = validateObject;
//# sourceMappingURL=json-validation.js.map