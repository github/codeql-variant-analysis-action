import { BaseType } from "./BaseType";
export declare class ReferenceType extends BaseType {
    private type;
    private id;
    private name;
    getId(): string;
    setId(id: string): void;
    getName(): string;
    setName(name: string): void;
    getType(): BaseType;
    setType(type: BaseType): void;
}
