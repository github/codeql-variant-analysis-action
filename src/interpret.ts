import { once } from "events";
import * as stream from "stream";
import * as util from "util";

export { toS, toMd, interpret };

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
function toS(e: any, nwo?: string, src?: string, ref?: string): string {
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

function toMd(tuple: any[], nwo?: string, src?: string, ref?: string): string {
  return `| ${tuple.map(e => toS(e, nwo, src, ref)).join(" | ")} |\n`;
}

async function write(output: stream.Writable, s: string) {
  if (!output.write(s)) {
    await once(output, "drain");
  }
}

const finished = util.promisify(stream.finished);

async function interpret(
  output: stream.Writable,
  results: any,
  nwo: string,
  src: string,
  ref?: string
) {
  await write(output, `## ${nwo}\n\n`);

  const colNames = results["#select"]["columns"].map(column => {
    return column.name || "-";
  });
  await write(output, toMd(colNames));

  await write(output, toMd(Array(colNames.length).fill("-")));

  for (const tuple of results["#select"]["tuples"]) {
    await write(output, toMd(tuple, nwo, src, ref));
  }

  output.end();
  await finished(output);
}
