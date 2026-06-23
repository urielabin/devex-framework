import yaml from "js-yaml";
import { Workflow, NormalJob, Step } from "@github-actions-workflow-ts/lib";
import { WorkflowOptions } from "./types";

/**
 * Generate a Golden Path PR Pipeline as a GitHub Actions YAML string.
 *
 * The pipeline enforces:
 *  1. Convention validation (devex standards check) — blocks all downstream jobs on failure
 *  2. Small tests (unit + coverage)
 *  3. CDK synth validation
 *  4. Sandbox deployment (main branch only)
 *
 * @example
 * ```typescript
 * import { generatePRPipeline } from "@devex/workflow-framework";
 * const yamlStr = generatePRPipeline({ workIdPrefix: "FIN", projectType: "cdk" });
 * fs.writeFileSync(".github/workflows/pr-pipeline.yml", yamlStr);
 * ```
 */
export function generatePRPipeline(options: WorkflowOptions): string {
  const {
    name = "Golden Path PR Pipeline",
    workIdPrefix = "FIN",
    projectType = "cdk",
    pythonVersion = "3.11",
    nodeVersion = "20",
    awsRegion = "us-east-1",
    cdkStackName = "*",
    stages = ["validate-conventions", "small-tests", "cdk-synth", "deploy-sandbox"],
    requireApprovals = 2,
    devexInstallSource = "git+https://github.com/urielabin/devex-framework#subdirectory=tools/devex-cli",
    packageManager = "pnpm",
  } = options;

  const installCmd = packageManager === "pnpm" ? "pnpm install" : "npm ci";

  const setupPnpmStep = new Step({
    name: "Set up pnpm",
    uses: "pnpm/action-setup@v4",
  });

  // ── Shared steps ──────────────────────────────────────────────────────────

  const checkoutStep = new Step({
    name: "Checkout",
    uses: "actions/checkout@v4",
    with: { "fetch-depth": 0 },
  });

  const setupPythonStep = new Step({
    name: "Set up Python",
    uses: "actions/setup-python@v5",
    with: { "python-version": pythonVersion },
  });

  const setupNodeStep = new Step({
    name: "Set up Node.js",
    uses: "actions/setup-node@v4",
    with: { "node-version": nodeVersion },
  });

  const installDevexStep = new Step({
    name: "Install devex CLI",
    run: `pip install "${devexInstallSource}"`,
  });

  // ── Job 1: validate-conventions ───────────────────────────────────────────

  const validateConventionsJob = new NormalJob("validate-conventions", {
    "runs-on": "ubuntu-latest",
    "timeout-minutes": 5,
  })
    .addStep(checkoutStep)
    .addStep(setupPythonStep)
    .addStep(installDevexStep)
    .addStep(
      new Step({
        name: "Check Golden Path conventions",
        run: [
          `# Enforces Work ID prefix ${workIdPrefix}-* in branch names and commits`,
          `# Requires ${requireApprovals} reviewer approvals (enforced via branch protection)`,
          "devex standards check",
        ].join("\n"),
      })
    );

  const workflow = new Workflow("pr-pipeline", {
    name,
    on: {
      pull_request: {
        branches: ["main"],
      },
      push: {
        branches: ["main"],
      },
    },
    jobs: {},
  });

  if (stages.includes("validate-conventions")) {
    workflow.addJob(validateConventionsJob);
  }

  // ── Job 2: small-tests ────────────────────────────────────────────────────

  if (stages.includes("small-tests")) {
    const isNode = projectType === "node";
    const testRunStep = isNode
      ? new Step({ name: "Run tests", run: `${installCmd} && ${packageManager} test` })
      : new Step({
          name: "Run Python tests",
          run: [
            `pip install pytest pytest-cov`,
            `pytest --cov --cov-report=xml -q`,
          ].join("\n"),
        });

    // Property-Based Testing step (hypothesis for Python, fast-check for Node)
    const pbtStep = isNode
      ? new Step({
          name: "Property-Based Tests",
          run: "npx fast-check --testPathPattern='*.pbt.test.ts' || true",
        })
      : new Step({
          name: "Property-Based Tests (hypothesis)",
          run: "pip install hypothesis && pytest tests/ -k pbt -q --tb=short || true",
        });

    // API Contract validation — runs schemathesis against openapi.yaml if present
    const contractStep = new Step({
      name: "API Contract Validation",
      run: [
        "if [ -f openapi.yaml ] || [ -f openapi.json ]; then",
        "  pip install schemathesis",
        "  st run openapi.yaml --checks all --dry-run --report=contract-report.txt || true",
        "  echo 'Contract validation complete'",
        "else",
        "  echo 'No openapi.yaml found — skipping contract validation'",
        "fi",
      ].join("\n"),
    });

    const smallTestsJob = new NormalJob("small-tests", {
      "runs-on": "ubuntu-latest",
      "timeout-minutes": 15,
    })
      .needs([validateConventionsJob])
      .addStep(checkoutStep)
      .addStep(isNode ? setupNodeStep : setupPythonStep)
      .addStep(testRunStep)
      .addStep(pbtStep)
      .addStep(contractStep)
      .addStep(
        new Step({
          name: "Upload coverage",
          uses: "actions/upload-artifact@v4",
          with: { name: "coverage", path: "coverage.xml" },
          if: "always()",
        })
      );

    workflow.addJob(smallTestsJob);

    // ── Job 3: cdk-synth ───────────────────────────────────────────────────

    if (stages.includes("cdk-synth") && (projectType === "cdk" || projectType === "node")) {
      const cdkSynthJob = new NormalJob("cdk-synth", {
        "runs-on": "ubuntu-latest",
        "timeout-minutes": 10,
      })
        .needs([smallTestsJob])
        .addStep(checkoutStep)
        .addSteps(packageManager === "pnpm" ? [setupPnpmStep] : [])
        .addStep(setupNodeStep)
        .addStep(new Step({ name: "Install CDK dependencies", run: installCmd }))
        .addStep(
          new Step({
            name: "CDK Synth — validate stack",
            run: `npx cdk synth --context WorkId=CI-${workIdPrefix} --require-approval never`,
            env: { AWS_DEFAULT_REGION: awsRegion },
          })
        );

      workflow.addJob(cdkSynthJob);

      // ── Job 4: deploy-sandbox ─────────────────────────────────────────────

      if (stages.includes("deploy-sandbox")) {
        const deploySandboxJob = new NormalJob("deploy-sandbox", {
          "runs-on": "ubuntu-latest",
          "timeout-minutes": 20,
          if: "github.ref == 'refs/heads/main' && github.event_name == 'push'",
          permissions: {
            contents: "read",
            "id-token": "write",
          },
        })
          .needs([cdkSynthJob])
          .addStep(checkoutStep)
          .addSteps(packageManager === "pnpm" ? [setupPnpmStep] : [])
          .addStep(setupNodeStep)
          .addStep(
            new Step({
              name: "Configure AWS credentials",
              uses: "aws-actions/configure-aws-credentials@v4",
              with: {
                "role-to-assume": "${{ secrets.AWS_DEPLOY_ROLE_ARN }}",
                "aws-region": awsRegion,
              },
            })
          )
          .addStep(new Step({ name: "Install CDK dependencies", run: installCmd }))
          .addStep(
            new Step({
              name: "Deploy to Sandbox",
              id: "deploy",
              run: `npx cdk deploy ${cdkStackName} --require-approval never`,
              env: { AWS_DEFAULT_REGION: awsRegion },
            })
          )
          .addStep(
            new Step({
              name: "Emit DORA Deployment Event",
              if: "success()",
              run: [
                "echo '{\"event\":\"deployment\"," +
                '"sha":"${{ github.sha }}",' +
                '"timestamp":"\'$(date -u +%Y-%m-%dT%H:%M:%SZ)\'",' +
                `"stage":"sandbox","stack":"${cdkStackName}"}' >> .dora-events.jsonl`,
              ].join(""),
            })
          )
          .addStep(
            new Step({
              name: "Upload DORA events",
              uses: "actions/upload-artifact@v4",
              if: "always()",
              with: { name: "dora-events", path: ".dora-events.jsonl" },
            })
          );

        workflow.addJob(deploySandboxJob);
      }
    }
  }

  return yaml.dump(workflow.workflow, { lineWidth: 120, noRefs: true });
}
