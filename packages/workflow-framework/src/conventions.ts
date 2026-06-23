/**
 * Golden Path conventions shared across all DevEx tooling.
 * These regexes are the single source of truth for Work ID enforcement.
 */

/** Matches a Universal Work ID: one or more uppercase letters, a dash, one or more digits. */
export const WORK_ID_REGEX = /^[A-Z]+-\d+$/;

/** Matches a Golden Path branch name: <type>/<WORK-ID>-<description> */
export const BRANCH_NAME_REGEX = /^(feat|fix|chore|refactor)\/[A-Z]+-\d+-.+$/;

/** Matches a Work ID anywhere inside a commit message. */
export const COMMIT_MSG_REGEX = /\[?[A-Z]+-\d+\]?/;

export type PipelineStage =
  | "validate-conventions"
  | "small-tests"
  | "cdk-synth"
  | "deploy-sandbox"
  | "deploy-staging"
  | "deploy-prod";

export interface PipelineConfig {
  workIdPrefix: string;
  requireTwoReviewers: boolean;
  stages: PipelineStage[];
  doraEnabled: boolean;
}

export type ProjectType = "python" | "node" | "cdk" | "go" | "clojure";

export interface DevExConfig {
  workIdPrefix: string;
  twoReviewers: boolean;
  pipelineType: "pr-pipeline" | "integration-pipeline";
  projectType: ProjectType;
}
