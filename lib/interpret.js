"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResultsMd = exports.createResultIndex = exports.interpret = exports.problemQueryMessage = exports.toTableRow = exports.entityToString = void 0;
const events_1 = require("events");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const stream_1 = __importDefault(require("stream"));
const util_1 = require("util");
const github_1 = require("@actions/github");
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
async function interpret(output, results, nwo, compatibleQueryKinds, src, ref) {
    // Convert a Windows-style srcLocation to Unix-style
    src = src.replace(/\\/g, "/");
    if (!src.startsWith("/")) {
        src = `/${src}`;
    }
    await write(output, `## ${nwo}\n\n`);
    if (compatibleQueryKinds.includes("Problem")) {
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
async function createResultsMd(octokit, issue_number, resultArtifacts) {
    const resultsMd = [];
    for (const response of resultArtifacts) {
        const repoName = await fs_1.default.promises.readFile(path_1.default.join(response.downloadPath, "nwo.txt"), "utf-8");
        const resultCount = parseInt(await fs_1.default.promises.readFile(path_1.default.join(response.downloadPath, "resultcount.txt"), "utf-8"), 10);
        if (resultCount > 0) {
            const md = path_1.default.join(response.downloadPath, "results.md");
            const comment = await octokit.rest.issues.createComment({
                owner: github_1.context.repo.owner,
                repo: github_1.context.repo.repo,
                issue_number,
                body: await fs_1.default.promises.readFile(md, "utf8"),
            });
            resultsMd.push(`| ${repoName} | [${resultCount} result(s)](${comment.data.html_url}) |`);
        }
        resultsMd.push(`| ${repoName} | _No results_ |`);
    }
    return resultsMd.join("\n");
}
exports.createResultsMd = createResultsMd;
async function createResultIndex(resultArtifacts) {
    return await Promise.all(resultArtifacts.map(async function (response) {
        const nwo = fs_1.default.readFileSync(path_1.default.join(response.downloadPath, "nwo.txt"), "utf-8");
        const id = response.artifactName;
        const results_count = parseInt(fs_1.default.readFileSync(path_1.default.join(response.downloadPath, "resultcount.txt"), "utf-8"), 10);
        const bqrs_file_size = fs_1.default.statSync(path_1.default.join(response.downloadPath, "results.bqrs")).size;
        let sarif_file_size = undefined;
        if (fs_1.default.existsSync(path_1.default.join(response.downloadPath, "results.sarif"))) {
            sarif_file_size = fs_1.default.statSync(path_1.default.join(response.downloadPath, "results.sarif")).size;
        }
        const resultIndexItem = {
            nwo,
            id,
            results_count,
            bqrs_file_size,
            sarif_file_size,
        };
        return resultIndexItem;
    }));
}
exports.createResultIndex = createResultIndex;
//# sourceMappingURL=interpret.js.map