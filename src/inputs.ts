import { getInput } from "@actions/core";

export interface Repo {
  id: number;
  nwo: string;
  downloadUrl?: string;

  // pat is deprecated and only used during integration tests
  pat?: string;
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
  return JSON.parse(getInput("repositories", { required: true }));
}

export function getWorkflowStatus(): string {
  return getInput("workflow_status", { required: true });
}

export function getInstructionsPath(): string {
  return getInput("instructions_path", { required: true });
}
