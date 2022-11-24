"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeReferenceNodeParser = void 0;
const typescript_1 = __importDefault(require("typescript"));
const NodeParser_1 = require("../NodeParser");
const AnnotatedType_1 = require("../Type/AnnotatedType");
const ArrayType_1 = require("../Type/ArrayType");
const NeverType_1 = require("../Type/NeverType");
const StringType_1 = require("../Type/StringType");
const invalidTypes = {
    [typescript_1.default.SyntaxKind.ModuleDeclaration]: true,
    [typescript_1.default.SyntaxKind.VariableDeclaration]: true,
};
class TypeReferenceNodeParser {
    constructor(typeChecker, childNodeParser) {
        this.typeChecker = typeChecker;
        this.childNodeParser = childNodeParser;
    }
    supportsNode(node) {
        return node.kind === typescript_1.default.SyntaxKind.TypeReference;
    }
    createType(node, context) {
        const typeSymbol = this.typeChecker.getSymbolAtLocation(node.typeName);
        if (typeSymbol.flags & typescript_1.default.SymbolFlags.Alias) {
            const aliasedSymbol = this.typeChecker.getAliasedSymbol(typeSymbol);
            return this.childNodeParser.createType(aliasedSymbol.declarations.filter((n) => !invalidTypes[n.kind])[0], this.createSubContext(node, context));
        }
        else if (typeSymbol.flags & typescript_1.default.SymbolFlags.TypeParameter) {
            return context.getArgument(typeSymbol.name);
        }
        else if (typeSymbol.name === "Array" || typeSymbol.name === "ReadonlyArray") {
            const type = this.createSubContext(node, context).getArguments()[0];
            if (type === undefined || type instanceof NeverType_1.NeverType) {
                return new NeverType_1.NeverType();
            }
            return new ArrayType_1.ArrayType(type);
        }
        else if (typeSymbol.name === "Date") {
            return new AnnotatedType_1.AnnotatedType(new StringType_1.StringType(), { format: "date-time" }, false);
        }
        else if (typeSymbol.name === "RegExp") {
            return new AnnotatedType_1.AnnotatedType(new StringType_1.StringType(), { format: "regex" }, false);
        }
        else {
            return this.childNodeParser.createType(typeSymbol.declarations.filter((n) => !invalidTypes[n.kind])[0], this.createSubContext(node, context));
        }
    }
    createSubContext(node, parentContext) {
        var _a;
        const subContext = new NodeParser_1.Context(node);
        if ((_a = node.typeArguments) === null || _a === void 0 ? void 0 : _a.length) {
            for (const typeArg of node.typeArguments) {
                const type = this.childNodeParser.createType(typeArg, parentContext);
                subContext.pushArgument(type);
            }
        }
        return subContext;
    }
}
exports.TypeReferenceNodeParser = TypeReferenceNodeParser;
//# sourceMappingURL=TypeReferenceNodeParser.js.map