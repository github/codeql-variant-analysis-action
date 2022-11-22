import ts from "typescript";
export declare function hasModifier(node: ts.Node, modifier: ts.SyntaxKind): boolean;
export declare function isPublic(node: ts.Node): boolean;
export declare function isStatic(node: ts.Node): boolean;
