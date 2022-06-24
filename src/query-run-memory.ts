import * as os from "os";

/**
 * Gets an OS-specific amount of memory (in MB) to reserve for OS processes
 * when the user doesn't explicitly specify a memory setting.
 * This is a heuristic to avoid OOM errors (exit code 137 / SIGKILL)
 * from committing too much of the available memory to CodeQL.
 * @returns {number}
 */
function getSystemReservedMemoryMegaBytes(): number {
  // Windows needs more memory for OS processes.
  return 1024 * (process.platform === "win32" ? 1.5 : 1);
}

/**
 * Get the value for the codeql `--ram` flag.
 * We use the total available memory minus a threshold reserved for the OS.
 *
 * @returns {number} the amount of RAM to use, in megabytes
 */
export function getMemoryFlagValue(): number {
  const totalMemoryBytes = os.totalmem();
  const totalMemoryMegaBytes = totalMemoryBytes / (1024 * 1024);
  const reservedMemoryMegaBytes = getSystemReservedMemoryMegaBytes();
  const memoryToUseMegaBytes = totalMemoryMegaBytes - reservedMemoryMegaBytes;

  return Math.floor(memoryToUseMegaBytes);
}
