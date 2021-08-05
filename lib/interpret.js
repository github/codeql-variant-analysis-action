"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toS = void 0;
function toS(e, nwo, src, ref) {
    if (ref === undefined) {
        ref = "HEAD";
    }
    if (typeof e !== "object") {
        // Convert integers, also catch-all for anything else we haven't seen yet
        return e.toString();
    }
    let url = `${e.url.uri}#L${e.url.startLine}`;
    if (url.startsWith(`file:${src}`)) {
        // Make path relative
        const relative = url.substr(`file:${src}`.length);
        url = `https://github.com/${nwo}/blob/${ref}${relative}`;
    }
    // For now we produce a link even if the target is outside the source archive
    // so we don't just the location away.
    url = `[${e.label}](${url})`;
    return url;
}
exports.toS = toS;
// def to_md(g, tuple, nwo, src=None):
//     tuple = [ to_s(e, nwo, src) for e in tuple]
//     g.write(f"|{'|'.join(tuple)}|\n")
// function toMd(tuple: any[], nwo: string, src: string | undefined): string {
//   return "";
// }
//# sourceMappingURL=interpret.js.map