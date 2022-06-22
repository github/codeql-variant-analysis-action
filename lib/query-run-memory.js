"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemoryFlagValue = void 0;
const os = __importStar(require("os"));
/**
 * Gets an OS-specific amount of memory (in MB) to reserve for OS processes
 * when the user doesn't explicitly specify a memory setting.
 * This is a heuristic to avoid OOM errors (exit code 137 / SIGKILL)
 * from committing too much of the available memory to CodeQL.
 * @returns {number}
 */
function getSystemReservedMemoryMegaBytes() {
    // Windows needs more memory for OS processes.
    return 1024 * (process.platform === "win32" ? 1.5 : 1);
}
/**
 * Get the value for the codeql `--ram` flag.
 * We use the total available memory minus a threshold reserved for the OS.
 *
 * @returns {number} the amount of RAM to use, in megabytes
 */
function getMemoryFlagValue() {
    const totalMemoryBytes = os.totalmem();
    const totalMemoryMegaBytes = totalMemoryBytes / (1024 * 1024);
    const reservedMemoryMegaBytes = getSystemReservedMemoryMegaBytes();
    const memoryToUseMegaBytes = totalMemoryMegaBytes - reservedMemoryMegaBytes;
    return Math.floor(memoryToUseMegaBytes);
}
exports.getMemoryFlagValue = getMemoryFlagValue;
//# sourceMappingURL=query-run-memory.js.map