// Mock @github-actions-workflow-ts/lib so this test runs without building the external package.
jest.mock("@github-actions-workflow-ts/lib", () => {
  class Step {
    step: Record<string, unknown>;
    constructor(props: Record<string, unknown>) {
      this.step = props;
    }
  }

  class NormalJob {
    name: string;
    job: Record<string, unknown>;
    constructor(name: string, props: Record<string, unknown>) {
      this.name = name;
      this.job = { ...props, steps: [] };
    }
    needs(jobs: NormalJob[]) {
      this.job.needs = jobs.map((j) => j.name);
      return this;
    }
    addStep(step: Step) {
      (this.job.steps as unknown[]).push(step.step);
      return this;
    }
    addSteps(steps: Step[]) {
      (this.job.steps as unknown[]).push(...steps.map((s) => s.step));
      return this;
    }
  }

  class Workflow {
    filename: string;
    workflow: Record<string, unknown>;
    constructor(filename: string, props: Record<string, unknown>) {
      this.filename = filename;
      this.workflow = { ...props, jobs: {} };
    }
    addJob(job: NormalJob) {
      (this.workflow.jobs as Record<string, unknown>)[job.name] = job.job;
      return this;
    }
  }

  return { Workflow, NormalJob, Step };
});

import { generatePRPipeline } from "../src/workflows/pr-pipeline";

describe("generatePRPipeline", () => {
  it("returns a non-empty YAML string", () => {
    const result = generatePRPipeline({ workIdPrefix: "FIN" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("generated YAML contains validate-conventions job", () => {
    const result = generatePRPipeline({ workIdPrefix: "FIN" });
    expect(result).toContain("validate-conventions");
  });

  it("generated YAML contains devex standards check step", () => {
    const result = generatePRPipeline({ workIdPrefix: "FIN" });
    expect(result).toContain("devex standards check");
  });

  it("small-tests job depends on validate-conventions", () => {
    const result = generatePRPipeline({ workIdPrefix: "FIN" });
    // The needs array for small-tests should reference validate-conventions
    expect(result).toContain("validate-conventions");
    expect(result).toContain("small-tests");
    // Check that small-tests appears after validate-conventions in the YAML
    const validateIdx = result.indexOf("validate-conventions");
    const smallTestsIdx = result.indexOf("small-tests");
    expect(smallTestsIdx).toBeGreaterThan(validateIdx);
  });

  it("excludes deploy-sandbox when not in stages", () => {
    const result = generatePRPipeline({
      workIdPrefix: "FIN",
      stages: ["validate-conventions", "small-tests"],
    });
    expect(result).not.toContain("deploy-sandbox");
  });

  it("includes deploy-sandbox when explicitly requested", () => {
    const result = generatePRPipeline({
      workIdPrefix: "FIN",
      projectType: "cdk",
      stages: ["validate-conventions", "small-tests", "cdk-synth", "deploy-sandbox"],
    });
    expect(result).toContain("deploy-sandbox");
  });

  it("embeds the work id prefix in the pipeline", () => {
    const result = generatePRPipeline({ workIdPrefix: "PLAT" });
    expect(result).toContain("PLAT");
  });
});
