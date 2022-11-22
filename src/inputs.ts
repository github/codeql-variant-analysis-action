import * as fs from "fs";

import { getInput } from "@actions/core";

import { validateObject } from "./json-validation";

export interface Repo {
  id: number;
  nwo: string;
  downloadUrl?: string;

  // pat is deprecated and only used during integration tests
  pat?: string;
}

export type RepoArray = Repo[];

export interface Instructions {
  repositories: Repo[];
}

export function getControllerRepoId(): number {
  return parseInt(getInput("controller_repo_id", { required: true }));
}

export function getVariantAnalysisId(): number {
  return parseInt(getInput("variant_analysis_id"));
}

export function getSignedAuthToken(): string {
  return getInput("signed_auth_token");
}

export function getRepos(): Repo[] {
  const repos = JSON.parse(getInput("repositories", { required: true }));
  return validateObject(repos, "RepoArray");
}

export function getWorkflowStatus(): string {
  return getInput("workflow_status", { required: true });
}

export async function getInstructions(): Promise<Instructions> {
  const filePath = getInput("instructions_path", { required: true });
  const instructions = JSON.parse(
    await fs.promises.readFile(filePath, "utf-8")
  );
  return validateObject(instructions, "Instructions");
}
