"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserialize = void 0;
function camelize(_, value) {
    if (value && typeof value === "object") {
        for (const k in value) {
            if (k.match(/-./)) {
                const l = k.replace(/-./g, (x) => x[1].toUpperCase());
                value[l] = value[k];
                delete value[k];
            }
        }
    }
    return value;
}
function deserialize(s) {
    return JSON.parse(s, camelize);
}
exports.deserialize = deserialize;
//# sourceMappingURL=deserialize.js.map