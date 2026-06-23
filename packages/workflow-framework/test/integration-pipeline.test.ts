jest.mock("@github-actions-workflow-ts/lib", () => {
  class Step {
    step: Record<string, unknown>;
    constructor(props: Record<string, unknown>) { this.step = props; }
  }
  class NormalJob {
    name: string;
    job: Record<string, unknown>;
    constructor(name: string, props: Record<string, unknown>) {
      this.name = name;
      this.job = { ...props, steps: [] };
    }
    needs(jobs: NormalJob[]) { this.job.needs = jobs.map((j) => j.name); return this; }
    addStep(step: Step) { (this.job.steps as unknown[]).push(step.step); return this; }
    addSteps(steps: Step[]) { (this.job.steps as unknown[]).push(...steps.map((s) => s.step)); return this; }
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

import { generateIntegrationPipeline } from "../src/workflows/integration-pipeline";

describe("generateIntegrationPipeline", () => {
  it("returns a non-empty YAML string", () => {
    const result = generateIntegrationPipeline({ workIdPrefix: "FIN" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("triggers on push to main branch only", () => {
    const result = generateIntegrationPipeline({ workIdPrefix: "FIN" });
    expect(result).toContain("main");
    expect(result).not.toContain("pull_request");
  });

  it("includes deploy-staging job", () => {
    const result = generateIntegrationPipeline({ workIdPrefix: "FIN" });
    expect(result).toContain("deploy-staging");
  });

  it("includes deploy-production job", () => {
    const result = generateIntegrationPipeline({ workIdPrefix: "FIN" });
    expect(result).toContain("deploy-production");
  });

  it("deploy-production depends on smoke-tests-staging", () => {
    const result = generateIntegrationPipeline({ workIdPrefix: "FIN" });
    expect(result).toContain("smoke-tests-staging");
    const stagingIdx = result.indexOf("smoke-tests-staging");
    const prodIdx = result.indexOf("deploy-production");
    expect(prodIdx).toBeGreaterThan(stagingIdx);
  });

  it("emits DORA events on production deploy", () => {
    const result = generateIntegrationPipeline({ workIdPrefix: "FIN" });
    expect(result).toContain("dora");
  });
});
