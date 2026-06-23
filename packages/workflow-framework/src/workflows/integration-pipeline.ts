import yaml from "js-yaml";
import { NormalJob, Step, Workflow } from "@github-actions-workflow-ts/lib";
import { WorkflowOptions } from "./types";

/**
 * Generate a Golden Path Integration Pipeline as a GitHub Actions YAML string.
 *
 * The integration pipeline is triggered when a PR merges into the main branch.
 * It runs a full promotion sequence: Staging → Production, with a mandatory
 * manual approval gate between environments.
 *
 * Conceptual design:
 *
 *   merge to main
 *       │
 *       ▼
 *   integration-tests    ← Full regression suite + performance smoke tests
 *       │
 *       ▼
 *   deploy-staging       ← AWS CDK deploy to Staging; emits DORA event
 *       │
 *       ▼
 *   smoke-tests-staging  ← HTTP health-check + key endpoint validation
 *       │
 *       ▼
 *   production-gate      ← environment: production (requires manual approval in GitHub)
 *       │
 *       ▼
 *   deploy-production    ← AWS CDK deploy to Production; emits DORA deployment event
 *       │
 *       ▼
 *   post-deploy          ← Emit DORA Lead Time metric; notify Slack/Teams
 *
 * @example
 * ```typescript
 * import { generateIntegrationPipeline } from "@devex/workflow-framework";
 * import { writeFileSync } from "fs";
 *
 * const yaml = generateIntegrationPipeline({
 *   workIdPrefix: "FIN",
 *   projectType: "cdk",
 *   awsRegion: "us-east-1",
 *   cdkStackName: "PaymentServiceStack",
 * });
 * writeFileSync(".github/workflows/integration-pipeline.yml", yaml);
 * ```
 */
export function generateIntegrationPipeline(options: WorkflowOptions): string {
  const {
    name = "Golden Path Integration Pipeline",
    workIdPrefix = "FIN",
    pythonVersion = "3.11",
    nodeVersion = "20",
    awsRegion = "us-east-1",
    cdkStackName = "*",
    packageManager = "pnpm",
  } = options;

  const installCmd = packageManager === "pnpm" ? "pnpm install" : "npm ci";

  const checkoutStep = new Step({
    name: "Checkout",
    uses: "actions/checkout@v4",
    with: { "fetch-depth": 0 },
  });

  const setupNodeStep = new Step({
    name: "Set up Node.js",
    uses: "actions/setup-node@v4",
    with: { "node-version": nodeVersion },
  });

  const setupPnpmStep = new Step({
    name: "Set up pnpm",
    uses: "pnpm/action-setup@v4",
  });

  const setupPythonStep = new Step({
    name: "Set up Python",
    uses: "actions/setup-python@v5",
    with: { "python-version": pythonVersion },
  });

  const configureAwsStep = new Step({
    name: "Configure AWS credentials",
    uses: "aws-actions/configure-aws-credentials@v4",
    with: {
      "role-to-assume": "${{ secrets.AWS_DEPLOY_ROLE_ARN }}",
      "aws-region": awsRegion,
    },
  });

  // ── Job 1: integration-tests ──────────────────────────────────────────────
  const integrationTestsJob = new NormalJob("integration-tests", {
    "runs-on": "ubuntu-latest",
    "timeout-minutes": 20,
  })
    .addStep(checkoutStep)
    .addStep(setupPythonStep)
    .addStep(
      new Step({
        name: "Install dependencies",
        run: "pip install pytest pytest-cov hypothesis",
      })
    )
    .addStep(
      new Step({
        name: "Run integration tests",
        run: "pytest tests/ -v --tb=short -m 'not unit'",
        env: {
          AWS_DEFAULT_REGION: awsRegion,
          // Point to DynamoDB Local when running in CI with docker-compose
          DYNAMODB_ENDPOINT: "${{ vars.DYNAMODB_ENDPOINT || '' }}",
        },
      })
    );

  // ── Job 2: deploy-staging ─────────────────────────────────────────────────
  const deployStagingJob = new NormalJob("deploy-staging", {
    "runs-on": "ubuntu-latest",
    "timeout-minutes": 20,
    environment: "staging",
    permissions: { contents: "read", "id-token": "write" },
  })
    .needs([integrationTestsJob])
    .addStep(checkoutStep)
    .addSteps(packageManager === "pnpm" ? [setupPnpmStep] : [])
    .addStep(setupNodeStep)
    .addStep(configureAwsStep)
    .addStep(new Step({ name: "Install CDK dependencies", run: installCmd }))
    .addStep(
      new Step({
        name: "Deploy to Staging",
        id: "deploy-staging",
        run: `npx cdk deploy ${cdkStackName} --require-approval never --context WorkId=CI-${workIdPrefix}`,
        env: { AWS_DEFAULT_REGION: awsRegion },
      })
    )
    .addStep(
      new Step({
        name: "Emit DORA staging deployment",
        if: "success()",
        run:
          "echo '{\"event\":\"deployment\",\"stage\":\"staging\",\"sha\":\"${{ github.sha }}\"}'" +
          " >> .dora-events.jsonl",
      })
    );

  // ── Job 3: smoke-tests-staging ────────────────────────────────────────────
  const smokeTestsStagingJob = new NormalJob("smoke-tests-staging", {
    "runs-on": "ubuntu-latest",
    "timeout-minutes": 10,
  })
    .needs([deployStagingJob])
    .addStep(checkoutStep)
    .addStep(setupPythonStep)
    .addStep(
      new Step({
        name: "Run staging smoke tests",
        run: [
          "pip install httpx pytest",
          "pytest tests/smoke/ -v --tb=short",
        ].join("\n"),
        env: { SERVICE_BASE_URL: "${{ vars.STAGING_BASE_URL }}" },
      })
    );

  // ── Job 4: deploy-production ──────────────────────────────────────────────
  // The `environment: production` triggers a GitHub manual approval gate.
  const deployProductionJob = new NormalJob("deploy-production", {
    "runs-on": "ubuntu-latest",
    "timeout-minutes": 20,
    // Requires a GitHub environment named "production" with required reviewers configured
    environment: "production",
    permissions: { contents: "read", "id-token": "write" },
  })
    .needs([smokeTestsStagingJob])
    .addStep(checkoutStep)
    .addSteps(packageManager === "pnpm" ? [setupPnpmStep] : [])
    .addStep(setupNodeStep)
    .addStep(configureAwsStep)
    .addStep(new Step({ name: "Install CDK dependencies", run: installCmd }))
    .addStep(
      new Step({
        name: "Deploy to Production",
        id: "deploy-prod",
        run: `npx cdk deploy ${cdkStackName} --require-approval never --context WorkId=CI-${workIdPrefix}`,
        env: { AWS_DEFAULT_REGION: awsRegion },
      })
    )
    .addStep(
      new Step({
        name: "Emit DORA production deployment + Lead Time",
        if: "success()",
        run: [
          "pip install gitpython",
          "python -c \"",
          "import git, json; from datetime import datetime, UTC",
          "repo = git.Repo('.')",
          "first_commit = list(repo.iter_commits('HEAD'))[-1]",
          "lead_time = (datetime.now(UTC).timestamp() - first_commit.committed_date) / 3600",
          "print(json.dumps({'event': 'deployment', 'stage': 'production',",
          "  'lead_time_hours': round(lead_time, 2), 'sha': repo.head.commit.hexsha[:8]}))",
          "\" >> .dora-events.jsonl",
        ].join("\n"),
      })
    )
    .addStep(
      new Step({
        name: "Upload DORA events",
        uses: "actions/upload-artifact@v4",
        if: "always()",
        with: { name: "dora-events-integration", path: ".dora-events.jsonl" },
      })
    );

  const workflow = new Workflow("integration-pipeline", {
    name,
    on: {
      push: { branches: ["main"] },
    },
    jobs: {},
  });

  workflow
    .addJob(integrationTestsJob)
    .addJob(deployStagingJob)
    .addJob(smokeTestsStagingJob)
    .addJob(deployProductionJob);

  return yaml.dump(workflow.workflow, { lineWidth: 120, noRefs: true });
}
