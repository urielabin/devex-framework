import { PipelineStage, ProjectType } from "../conventions";

export interface WorkflowOptions {
  /** Workflow name */
  name?: string;
  /** Work ID prefix enforced in conventions (e.g. "FIN") */
  workIdPrefix: string;
  /** Project type determines which test runner to use */
  projectType?: ProjectType;
  /** Node.js version for setup-node step */
  nodeVersion?: string;
  /** Python version for setup-python step */
  pythonVersion?: string;
  /** AWS region for CDK deploy steps */
  awsRegion?: string;
  /** CDK stack name to deploy */
  cdkStackName?: string;
  /** Pipeline stages to include (defaults to validate + small-tests + cdk-synth) */
  stages?: PipelineStage[];
  /** Number of required PR approvals written into branch protection comment */
  requireApprovals?: number;
  /** pip-installable git source for the devex CLI, used in the generated "Install devex CLI" step */
  devexInstallSource?: string;
  /** Node package manager used for install/test/build steps. Defaults to "pnpm" (the ecosystem convention). */
  packageManager?: "npm" | "pnpm";
}
