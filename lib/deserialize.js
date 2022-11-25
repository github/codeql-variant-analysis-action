"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.camelize = void 0;
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
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
/* eslint-enable @typescript-eslint/explicit-module-boundary-types */
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
//# sourceMappingURL=deserialize.js.map