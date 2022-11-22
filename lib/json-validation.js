"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateObject = exports.ALL_SCHEMAS = void 0;
const fs = __importStar(require("fs"));
const ajv_1 = __importDefault(require("ajv"));
exports.ALL_SCHEMAS = ["RepoArray", "Instructions"];
function validateObject(obj, schema) {
    const schemaContents = fs.readFileSync(`${__dirname}/../src/json-schemas/${schema}.json`);
    const ajv = new ajv_1.default();
    const validate = ajv.compile(schemaContents);
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