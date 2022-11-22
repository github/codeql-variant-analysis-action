"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLiterals = void 0;
const UnknownTypeError_1 = require("../Error/UnknownTypeError");
const AliasType_1 = require("../Type/AliasType");
const LiteralType_1 = require("../Type/LiteralType");
const UnionType_1 = require("../Type/UnionType");
function* _extractLiterals(type) {
    if (!type) {
        return;
    }
    if (type instanceof LiteralType_1.LiteralType) {
        yield type.getValue().toString();
        return;
    }
    if (type instanceof UnionType_1.UnionType) {
        for (const t of type.getTypes()) {
            yield* _extractLiterals(t);
        }
        return;
    }
    if (type instanceof AliasType_1.AliasType) {
        yield* _extractLiterals(type.getType());
        return;
    }
    throw new UnknownTypeError_1.UnknownTypeError(type);
}
function extractLiterals(type) {
    return [..._extractLiterals(type)];
}
exports.extractLiterals = extractLiterals;
//# sourceMappingURL=extractLiterals.js.map