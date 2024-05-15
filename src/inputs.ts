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
  features: Record<string, boolean>;
}

export function getControllerRepoId(): number {
  return parseInt(getInput("controller_repo_id", { required: true }));
}

export function getVariantAnalysisId(): number {
  return parseInt(getInput("variant_analysis_id", { required: true }));
}

export function getSignedAuthToken(): string {
  return getInput("signed_auth_token", { required: true });
}

export function getRepos(): Repo[] {
  return validateObject(
    JSON.parse(getInput("repositories", { required: true })),
    "repoArray",
  );
}

export function getWorkflowStatus(): string {
  return getInput("workflow_status", { required: true });
}

export async function getInstructions(): Promise<Instructions> {
  const filePath = getInput("instructions_path", { required: true });
  return validateObject(
    JSON.parse(await fs.promises.readFile(filePath, "utf-8")),
    "instructions",
  );
}
