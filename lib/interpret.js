"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpret = exports.problemQueryMessage = exports.toTableRow = exports.entityToString = void 0;
const events_1 = require("events");
const stream_1 = __importDefault(require("stream"));
const util_1 = require("util");
// Methods in this file consume the output from `codeql bqrs decode --format=json`.
// For example:
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
// If e is an object representing a single entity, turn it into a markdown representation.
function entityToString(e, nwo, src, ref) {
    // Handle integers, strings, and anything else we haven't seen yet
    if (typeof e !== "object") {
        return `${e}`;
    }
    let url = getEntityURL(e, nwo, src, ref);
    // For now we produce a link even if the target is outside the source archive
    // so we don't just throw the location away.
    url = `[${e.label}](${url})`;
    return url;
}
exports.entityToString = entityToString;
// If e is an object representing a single entity, turn it into a link to
// the github.com code viewer.
function getEntityURL(e, nwo, src, ref) {
    let url = `${e.url.uri}#L${e.url.startLine}`;
    if (nwo !== undefined && src !== undefined && url.startsWith(`file:${src}`)) {
        // Make path relative
        const relative = url.substr(`file:${src}`.length);
        url = `https://github.com/${nwo}/blob/${ref}${relative}`;
    }
    return url;
}
// Returns the formatted message for a problem query, with any placeholders filled in.
function problemQueryMessage(tuple, nwo, src, ref) {
    // Start with just the raw message, and then fill in any placeholders
    let message = tuple[1];
    // The index in the message of the next "$@", or -1 if there are no more placeholders to fill
    let nextMessageDollarAtIndex = message.indexOf("$@");
    // The index in the tuple of the next placeholder to take
    let nextPlaceholderTupleIndex = 2;
    while (nextMessageDollarAtIndex !== -1 &&
        nextPlaceholderTupleIndex < tuple.length - 1) {
        const linkUrl = getEntityURL(tuple[nextPlaceholderTupleIndex], nwo, src, ref);
        const linkText = tuple[nextPlaceholderTupleIndex + 1];
        const link = `[${linkText}](${linkUrl})`;
        message =
            message.substring(0, nextMessageDollarAtIndex) +
                link +
                message.substring(nextMessageDollarAtIndex + 2);
        // Search for the next $@ starting after the link we just inserted so as not to recurse
        nextMessageDollarAtIndex = message.indexOf("$@", nextMessageDollarAtIndex + link.length);
        nextPlaceholderTupleIndex += 2;
    }
    return message;
}
exports.problemQueryMessage = problemQueryMessage;
// Returns the given set of strings formatted as a row of a markdown table
function toTableRow(data) {
    return `| ${data.join(" | ")} |\n`;
}
exports.toTableRow = toTableRow;
// Returns the second row of a markdown table, between the column names and the body
function tableDashesRow(numColumns) {
    return toTableRow(Array(numColumns).fill("-"));
}
const finished = (0, util_1.promisify)(stream_1.default.finished);
async function write(output, s) {
    if (!output.write(s)) {
        await (0, events_1.once)(output, "drain");
    }
}
async function interpret(output, results, nwo, src, ref) {
    // Convert a Windows-style srcLocation to Unix-style
    src = src.replace(/\\/g, "/");
    if (!src.startsWith("/")) {
        src = `/${src}`;
    }
    await write(output, `## ${nwo}\n\n`);
    if (isProblemQuery(results)) {
        // Output as problem with placeholders
        const colNames = ["-", "Message"];
        await write(output, toTableRow(colNames));
        await write(output, tableDashesRow(colNames.length));
        for (const tuple of results["#select"]["tuples"]) {
            const entityCol = entityToString(tuple[0], nwo, src, ref);
            const messageCol = problemQueryMessage(tuple, nwo, src, ref);
            await write(output, toTableRow([entityCol, messageCol]));
        }
    }
    else {
        // Output raw table
        const colNames = results["#select"]["columns"].map((c) => c.name || "-");
        await write(output, toTableRow(colNames));
        await write(output, tableDashesRow(colNames.length));
        for (const tuple of results["#select"]["tuples"]) {
            const row = tuple.map((e) => entityToString(e, nwo, src, ref));
            await write(output, toTableRow(row));
        }
    }
    output.end();
    return finished(output);
}
exports.interpret = interpret;
// Do the given set of results look like they are for a
// problem query.
function isProblemQuery(results) {
    const columns = results["#select"]["columns"];
    // A problem query must have an even number of columns
    // and have at least 2 columns.
    if (columns.length < 2 || columns.length % 2 !== 0) {
        return false;
    }
    // The first column must be an entity and the second column must be a string.
    if (columns[0]["kind"] !== "Entity" || columns[1]["kind"] !== "String") {
        return false;
    }
    // After that the second column in each pair must be a string.
    for (let i = 3; i < columns.length; i += 2) {
        if (columns[i]["kind"] !== "String") {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=interpret.js.map