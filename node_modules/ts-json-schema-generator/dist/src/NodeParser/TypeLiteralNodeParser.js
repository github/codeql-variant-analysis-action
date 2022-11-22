"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeLiteralNodeParser = void 0;
const typescript_1 = __importDefault(require("typescript"));
const NeverType_1 = require("../Type/NeverType");
const ObjectType_1 = require("../Type/ObjectType");
const isHidden_1 = require("../Utils/isHidden");
const nodeKey_1 = require("../Utils/nodeKey");
class TypeLiteralNodeParser {
    constructor(childNodeParser, additionalProperties) {
        this.childNodeParser = childNodeParser;
        this.additionalProperties = additionalProperties;
    }
    supportsNode(node) {
        return node.kind === typescript_1.default.SyntaxKind.TypeLiteral;
    }
    createType(node, context, reference) {
        const id = this.getTypeId(node, context);
        if (reference) {
            reference.setId(id);
            reference.setName(id);
        }
        const properties = this.getProperties(node, context);
        if (properties === undefined) {
            return new NeverType_1.NeverType();
        }
        return new ObjectType_1.ObjectType(id, [], properties, this.getAdditionalProperties(node, context));
    }
    getProperties(node, context) {
        let hasRequiredNever = false;
        const properties = node.members
            .filter(typescript_1.default.isPropertySignature)
            .filter((propertyNode) => !(0, isHidden_1.isNodeHidden)(propertyNode))
            .map((propertyNode) => {
            const propertySymbol = propertyNode.symbol;
            const type = this.childNodeParser.createType(propertyNode.type, context);
            const objectProperty = new ObjectType_1.ObjectProperty(propertySymbol.getName(), type, !propertyNode.questionToken);
            return objectProperty;
        })
            .filter((prop) => {
            if (prop.isRequired() && prop.getType() instanceof NeverType_1.NeverType) {
                hasRequiredNever = true;
            }
            return !(prop.getType() instanceof NeverType_1.NeverType);
        });
        if (hasRequiredNever) {
            return undefined;
        }
        return properties;
    }
    getAdditionalProperties(node, context) {
        var _a;
        const indexSignature = node.members.find(typescript_1.default.isIndexSignatureDeclaration);
        if (!indexSignature) {
            return this.additionalProperties;
        }
        return (_a = this.childNodeParser.createType(indexSignature.type, context)) !== null && _a !== void 0 ? _a : this.additionalProperties;
    }
    getTypeId(node, context) {
        return `structure-${(0, nodeKey_1.getKey)(node, context)}`;
    }
}
exports.TypeLiteralNodeParser = TypeLiteralNodeParser;
//# sourceMappingURL=TypeLiteralNodeParser.js.map