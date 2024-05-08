import { OutgoingHttpHeaders } from "http";
import { join } from "path";
import { performance } from "perf_hooks";

import { debug, info } from "@actions/core";
import { rmRF } from "@actions/io";
import {
  cacheDir,
  downloadTool,
  extractTar,
  find as findInToolCache,
} from "@actions/tool-cache";
import { v4 as uuidV4 } from "uuid";

import { assertNever } from "./util";

type CodeQLToolsSource =
  | {
      codeqlFolder: string;
      sourceType: "toolcache";
    }
  | {
      codeqlURL: string;
      sourceType: "download";
    };

function getCodeQLBundleName(): string {
  let platform: string;
  if (process.platform === "win32") {
    platform = "win64";
  } else if (process.platform === "linux") {
    platform = "linux64";
  } else if (process.platform === "darwin") {
    platform = "osx64";
  } else {
    return "codeql-bundle.tar.gz";
  }
  return `codeql-bundle-${platform}.tar.gz`;
}

/**
 * Returns the path to the CodeQL bundle after finding or downloading it.
 *
 * @param tempDir A temporary directory to download the bundle to.
 * @param cliVersion The version of the CLI to use.
 */
export async function setupCodeQLBundle(
  tempDir: string,
  cliVersion: string,
): Promise<string> {
  const source = getCodeQLSource(cliVersion);

  let codeqlFolder: string;
  switch (source.sourceType) {
    case "toolcache":
      codeqlFolder = source.codeqlFolder;
      debug(`CodeQL found in cache ${codeqlFolder}`);
      break;
    case "download": {
      codeqlFolder = await downloadCodeQL(
        cliVersion,
        source.codeqlURL,
        tempDir,
      );
      break;
    }
    default:
      assertNever(source);
  }

  return codeqlFolder;
}

/**
 * Determine where to find the CodeQL tools. This will check the tool cache
 * first, and if the tools are not found there, it will provide a download
 * URL for the tools.
 *
 * @param cliVersion The CLI version of the CodeQL bundle to find
 */
function getCodeQLSource(cliVersion: string): CodeQLToolsSource {
  // If we find the specified CLI version, we always use that.
  const codeqlFolder = findInToolCache("CodeQL", cliVersion);

  if (codeqlFolder) {
    info(`Found CodeQL tools version ${cliVersion} in the toolcache.`);

    return {
      codeqlFolder,
      sourceType: "toolcache",
    };
  }

  info(`Did not find CodeQL tools version ${cliVersion} in the toolcache.`);

  /** Tag name of the CodeQL bundle, for example `codeql-bundle-v2.17.1`. */
  const tagName = `codeql-bundle-v${cliVersion}`;

  const url = `https://github.com/github/codeql-action/releases/download/${tagName}/${getCodeQLBundleName()}`;

  return {
    codeqlURL: url,
    sourceType: "download",
  };
}

/**
 * @param cliVersion The CLI version of the CodeQL bundle to download
 * @param codeqlURL The URL to download the CodeQL bundle from
 * @param tempDir The temporary directory to download the CodeQL bundle to
 * @return the path to the downloaded CodeQL tools folder
 */
async function downloadCodeQL(
  cliVersion: string,
  codeqlURL: string,
  tempDir: string,
): Promise<string> {
  const headers: OutgoingHttpHeaders = {
    accept: "application/octet-stream",
  };
  info(`Downloading CodeQL tools from ${codeqlURL} . This may take a while.`);

  const dest = join(tempDir, uuidV4());
  const finalHeaders = Object.assign(
    // eslint-disable-next-line @typescript-eslint/naming-convention
    { "User-Agent": "CodeQL Variant Analysis Action" },
    headers,
  );

  const toolsDownloadStart = performance.now();
  const archivedBundlePath = await downloadTool(
    codeqlURL,
    dest,
    undefined,
    finalHeaders,
  );
  const toolsDownloadDurationMs = Math.round(
    performance.now() - toolsDownloadStart,
  );

  debug(
    `Finished downloading CodeQL bundle to ${archivedBundlePath} (${toolsDownloadDurationMs} ms).`,
  );

  debug("Extracting CodeQL bundle.");
  const extractionStart = performance.now();
  const extractedBundlePath = await extractTar(archivedBundlePath);
  const extractionMs = Math.round(performance.now() - extractionStart);
  debug(
    `Finished extracting CodeQL bundle to ${extractedBundlePath} (${extractionMs} ms).`,
  );
  await rmRF(archivedBundlePath);

  debug("Caching CodeQL bundle.");
  const toolcachedBundlePath = await cacheDir(
    extractedBundlePath,
    "CodeQL",
    cliVersion,
  );

  // Defensive check: we expect `cacheDir` to copy the bundle to a new location.
  if (toolcachedBundlePath !== extractedBundlePath) {
    await rmRF(extractedBundlePath);
  }

  return toolcachedBundlePath;
}
