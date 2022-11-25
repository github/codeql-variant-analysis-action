"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.camelize = void 0;
function camelize(_, value) {
    if (value && typeof value === "object") {
        for (const k in value) {
            if (/-./.exec(k)) {
                const l = k.replace(/-./g, (x) => x[1].toUpperCase());
                value[l] = value[k];
                delete value[k];
            }
        }
    }
    return value;
}
exports.camelize = camelize;
//# sourceMappingURL=deserialize.js.map