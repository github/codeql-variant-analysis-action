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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpret = exports.toMd = exports.toS = void 0;
const events_1 = require("events");
const stream = __importStar(require("stream"));
const util = __importStar(require("util"));
// If e is an object, then we assume it is a single entity result of the form
// produced by `codeql bqrs decode --format=json`. For example:
//
// {
//   "id": 7661,
//   "label": "CERTSTORE_DOESNT_WORK_ON_LINIX",
//   "url": {
//     "uri": "file:/home/runner/work/qc-demo-github-certstore/qc-demo-github-certstore/certstore_linux.go",
//     "startLine": 8,
//     "startColumn": 2,
//     "endLine": 8,
//     "endColumn": 31
//   }
// }
//
// In this case then if src is a prefix of url.uri, then we turn it into a link
// to the github.com code viewer.
function toS(e, nwo, src, ref) {
    if (ref === undefined) {
        ref = "HEAD";
    }
    if (typeof e !== "object") {
        // Convert integers, also catch-all for anything else we haven't seen yet
        return `${e}`;
    }
    let url = `${e.url.uri}#L${e.url.startLine}`;
    if (nwo !== undefined && src !== undefined && url.startsWith(`file:${src}`)) {
        // Make path relative
        const relative = url.substr(`file:${src}`.length);
        url = `https://github.com/${nwo}/blob/${ref}${relative}`;
    }
    // For now we produce a link even if the target is outside the source archive
    // so we don't just throw the location away.
    url = `[${e.label}](${url})`;
    return url;
}
exports.toS = toS;
function toMd(tuple, nwo, src, ref) {
    return `| ${tuple.map((e) => toS(e, nwo, src, ref)).join(" | ")} |\n`;
}
exports.toMd = toMd;
async function write(output, s) {
    if (!output.write(s)) {
        await events_1.once(output, "drain");
    }
}
const finished = util.promisify(stream.finished);
async function interpret(output, results, nwo, src, ref) {
    await write(output, `## ${nwo}\n\n`);
    const colNames = results.select.columns.map((column) => {
        return column.name || "-";
    });
    await write(output, toMd(colNames));
    await write(output, toMd(Array(colNames.length).fill("-")));
    for (const tuple of results.select.tuples) {
        await write(output, toMd(tuple, nwo, src, ref));
    }
    output.end();
    await finished(output);
}
exports.interpret = interpret;
//# sourceMappingURL=interpret.js.map