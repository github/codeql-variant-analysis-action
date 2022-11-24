"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnionTypeFormatter = void 0;
const LiteralType_1 = require("../Type/LiteralType");
const NeverType_1 = require("../Type/NeverType");
const UnionType_1 = require("../Type/UnionType");
const derefType_1 = require("../Utils/derefType");
const typeKeys_1 = require("../Utils/typeKeys");
const uniqueArray_1 = require("../Utils/uniqueArray");
class UnionTypeFormatter {
    constructor(childTypeFormatter) {
        this.childTypeFormatter = childTypeFormatter;
    }
    supportsType(type) {
        return type instanceof UnionType_1.UnionType;
    }
    getDefinition(type) {
        const definitions = type
            .getTypes()
            .filter((item) => !((0, derefType_1.derefType)(item) instanceof NeverType_1.NeverType))
            .map((item) => this.childTypeFormatter.getDefinition(item));
        const discriminator = type.getDiscriminator();
        if (discriminator !== undefined) {
            const kindTypes = type
                .getTypes()
                .filter((item) => !((0, derefType_1.derefType)(item) instanceof NeverType_1.NeverType))
                .map((item) => (0, typeKeys_1.getTypeByKey)(item, new LiteralType_1.LiteralType(discriminator)));
            const undefinedIndex = kindTypes.findIndex((item) => item === undefined);
            if (undefinedIndex != -1) {
                throw new Error(`Cannot find discriminator keyword "${discriminator}" in type ${JSON.stringify(type.getTypes()[undefinedIndex])}.`);
            }
            const kindDefinitions = kindTypes.map((item) => this.childTypeFormatter.getDefinition(item));
            const allOf = [];
            for (let i = 0; i < definitions.length; i++) {
                allOf.push({
                    if: {
                        properties: { [discriminator]: kindDefinitions[i] },
                    },
                    then: definitions[i],
                });
            }
            return { allOf };
        }
        let stringType = true;
        let oneNotEnum = false;
        for (const def of definitions) {
            if (def.type !== "string") {
                stringType = false;
                break;
            }
            if (def.enum === undefined) {
                oneNotEnum = true;
            }
        }
        if (stringType && oneNotEnum) {
            const values = [];
            for (const def of definitions) {
                if (def.enum) {
                    values.push(...def.enum);
                }
                else if (def.const) {
                    values.push(def.const);
                }
                else {
                    return {
                        type: "string",
                    };
                }
            }
            return {
                type: "string",
                enum: values,
            };
        }
        const flattenedDefinitions = [];
        for (const def of definitions) {
            const keys = Object.keys(def);
            if (keys.length === 1 && keys[0] === "anyOf") {
                flattenedDefinitions.push(...def.anyOf);
            }
            else {
                flattenedDefinitions.push(def);
            }
        }
        return flattenedDefinitions.length > 1
            ? {
                anyOf: flattenedDefinitions,
            }
            : flattenedDefinitions[0];
    }
    getChildren(type) {
        return (0, uniqueArray_1.uniqueArray)(type
            .getTypes()
            .reduce((result, item) => [...result, ...this.childTypeFormatter.getChildren(item)], []));
    }
}
exports.UnionTypeFormatter = UnionTypeFormatter;
//# sourceMappingURL=UnionTypeFormatter.js.map