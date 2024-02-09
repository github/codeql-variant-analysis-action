import { getExecOutput } from "@actions/exec";

export interface CodeqlCliOutput {
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
