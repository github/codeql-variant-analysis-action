import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EOL } from "node:os";
import { Writable } from "node:stream";

import { debug, error } from "@actions/core";
import { getExecOutput } from "@actions/exec";

import { asError } from "./errors";

interface CodeqlCliOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CodeqlCli {
  run(args: string[]): Promise<CodeqlCliOutput>;
}

export class BaseCodeqlCli implements CodeqlCli {
  constructor(private readonly codeqlPath: string) {}

  async run(args: string[]): Promise<CodeqlCliOutput> {
    const { stdout, stderr, exitCode } = await getExecOutput(
      this.codeqlPath,
      args,
    );

    return { stdout, stderr, exitCode };
  }
}

export class CodeqlCliServer implements CodeqlCli {
  /**
   * The process for the cli server, or undefined if one doesn't exist yet
   */
  private process?: ChildProcessWithoutNullStreams;
  /**
   * Queue of future commands
   */
  private readonly commandQueue: Array<() => void> = [];
  /**
   * Whether a command is running
   */
  private commandInProcess: boolean = false;
  /**
   * A buffer with a single null byte.
   */
  private readonly nullBuffer: Buffer = Buffer.alloc(1);

  constructor(private readonly codeqlPath: string) {}

  run(args: string[]): Promise<CodeqlCliOutput> {
    return new Promise((resolve, reject) => {
      const callback = (): void => {
        try {
          // eslint-disable-next-line github/no-then -- we might not run immediately
          this.runCommandImmediately(args).then(resolve, reject);
        } catch (err) {
          reject(asError(err));
        }
      };
      // If the server is not running a command, then run the given command immediately,
      // otherwise add to the queue
      if (this.commandInProcess) {
        this.commandQueue.push(callback);
      } else {
        callback();
      }
    });
  }

  shutdown() {
    this.killProcessIfRunning();
  }

  /**
   * Launch the cli server
   */
  private launchProcess(): ChildProcessWithoutNullStreams {
    const args = ["execute", "cli-server"];

    // Start the server process.
    const argsString = args.join(" ");
    void debug(`Starting using CodeQL CLI: ${this.codeqlPath} ${argsString}`);
    const child = spawn(this.codeqlPath, args);
    if (!child || !child.pid) {
      throw new Error(
        `Failed to start using command ${this.codeqlPath} ${argsString}.`,
      );
    }

    let lastStdout: string | Buffer | undefined = undefined;
    child.stdout.on("data", (data: string | Buffer) => {
      lastStdout = data;
    });
    // Set up event listeners.
    child.on("close", (code, signal) => {
      if (code !== null) {
        debug(`Child process exited with code ${code}`);
      }
      if (signal) {
        debug(`Child process exited due to receipt of signal ${signal}`);
      }
      // If the process exited abnormally, log the last stdout message,
      // It may be from the jvm.
      if (code !== 0 && lastStdout !== undefined) {
        debug(`Last stdout was "${lastStdout.toString()}"`);
      }
    });

    return child;
  }

  private async runCommandImmediately(
    args: string[],
  ): Promise<CodeqlCliOutput> {
    const stderrBuffers: Buffer[] = [];
    const parentProcess = process;
    if (this.commandInProcess) {
      throw new Error(
        "runCommandImmediately called while command was in process",
      );
    }
    this.commandInProcess = true;
    try {
      // Launch the process if it doesn't exist
      if (!this.process) {
        this.process = this.launchProcess();
      }
      const process = this.process;
      // The array of fragments of stdout
      const stdoutBuffers: Buffer[] = [];

      void debug(`Running using CodeQL CLI: ${args.join(" ")}`);
      try {
        await new Promise<void>((resolve, reject) => {
          // Follow standard Actions behavior and print any lines to stdout/stderr immediately
          let parentStdout: Writable;
          if (parentProcess.stdout instanceof Writable) {
            parentStdout = parentProcess.stdout;
          }
          let parentStderr: Writable | undefined = undefined;
          if (parentProcess.stderr instanceof Writable) {
            parentStderr = parentProcess.stderr;
          }

          // Start listening to stdout
          process.stdout.addListener("data", (newData: Buffer) => {
            stdoutBuffers.push(newData);

            if (
              newData.length > 0 &&
              newData.readUInt8(newData.length - 1) === 0
            ) {
              if (newData.length > 1) {
                parentStdout?.write(newData.subarray(0, newData.length - 1));
              }
            } else {
              parentStdout?.write(newData);
            }

            // If the buffer ends in '0' then exit.
            // We don't have to check the middle as no output will be written after the null until
            // the next command starts
            if (
              newData.length > 0 &&
              newData.readUInt8(newData.length - 1) === 0
            ) {
              resolve();
            }
          });
          // Listen to stderr
          process.stderr.addListener("data", (newData: Buffer) => {
            stderrBuffers.push(newData);

            parentStderr?.write(newData);
          });
          // Listen for process exit.
          process.addListener("close", (code) =>
            reject(
              new Error(
                `The process ${this.codeqlPath} ${args.join(" ")} exited with code ${code}`,
              ),
            ),
          );
          // Write the command followed by a null terminator.
          process.stdin.write(JSON.stringify(args), "utf8");
          process.stdin.write(this.nullBuffer);
        });

        void debug("CLI command succeeded.");

        const stdoutBuffer = Buffer.concat(stdoutBuffers);

        return {
          exitCode: 0,
          stdout: stdoutBuffer.toString("utf8", 0, stdoutBuffer.length - 1),
          stderr: Buffer.concat(stderrBuffers).toString("utf8"),
        };
      } catch (err) {
        // Kill the process if it isn't already dead.
        this.killProcessIfRunning();

        if (stderrBuffers.length > 0) {
          error(
            `Failed to run ${args.join(" ")}:${EOL} ${Buffer.concat(stderrBuffers).toString("utf8")}`,
          );
        }

        throw err;
      } finally {
        debug(Buffer.concat(stderrBuffers).toString("utf8"));
        // Remove the listeners we set up.
        process.stdout.removeAllListeners("data");
        process.stderr.removeAllListeners("data");
        process.removeAllListeners("close");
      }
    } finally {
      this.commandInProcess = false;
      // start running the next command immediately
      this.runNext();
    }
  }

  /**
   * Run the next command in the queue
   */
  private runNext(): void {
    const callback = this.commandQueue.shift();
    if (callback) {
      callback();
    }
  }

  private killProcessIfRunning(): void {
    if (this.process) {
      // Tell the Java CLI server process to shut down.
      debug("Sending shutdown request");
      try {
        this.process.stdin.write(JSON.stringify(["shutdown"]), "utf8");
        this.process.stdin.write(this.nullBuffer);
        debug("Sent shutdown request");
      } catch (e: unknown) {
        // We are probably fine here, the process has already closed stdin.
        debug(
          `Shutdown request failed: process stdin may have already closed. The error was ${e}`,
        );
        debug("Stopping the process anyway.");
      }
      // Close the stdin and stdout streams.
      // This is important on Windows where the child process may not die cleanly.
      this.process.stdin.end();
      this.process.kill();
      this.process.stdout.destroy();
      this.process.stderr.destroy();
      this.process = undefined;
    }
  }
}
