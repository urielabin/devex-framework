import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { WORK_ID_REGEX } from "../conventions";

export interface GoldenPathStackProps extends cdk.StackProps {
  /** Work ID prefix required (e.g. "FIN"). */
  workIdPrefix: string;
  /** Team name for mandatory cost allocation tags. */
  teamName: string;
  /** Owner email for mandatory cost allocation tags. */
  ownerEmail: string;
}

/**
 * Base CDK Stack that enforces Golden Path conventions at synth time.
 *
 * - Validates `WorkId` context variable before synthesis proceeds.
 * - Applies mandatory finops tags to the entire stack.
 * - Exposes `registerDoraDeployEvent()` for DORA metric capture.
 *
 * @example
 * ```typescript
 * class MyStack extends GoldenPathStack {
 *   constructor(scope: Construct, id: string, props: GoldenPathStackProps) {
 *     super(scope, id, props);
 *     new LambdaService(this, "PaymentService", { ... });
 *   }
 * }
 *
 * const app = new cdk.App();
 * new MyStack(app, "MyStack", { workIdPrefix: "FIN", teamName: "payments", ownerEmail: "team@example.com" });
 * ```
 */
export class GoldenPathStack extends cdk.Stack {
  protected readonly workId: string;

  constructor(scope: Construct, id: string, props: GoldenPathStackProps) {
    super(scope, id, props);

    // Validate WorkId context at synth time — blocks deploy if missing or malformed.
    const rawWorkId = this.node.tryGetContext("WorkId") as string | undefined;
    if (!rawWorkId) {
      throw new Error(
        `[GoldenPathStack] Missing CDK context variable "WorkId". ` +
          `Pass it with: cdk deploy --context WorkId=${props.workIdPrefix}-123`
      );
    }

    // Allow CI placeholder (CI-FIN) as well as real Work IDs (FIN-123)
    const isCiPlaceholder = rawWorkId.startsWith("CI-");
    if (!isCiPlaceholder && !WORK_ID_REGEX.test(rawWorkId)) {
      throw new Error(
        `[GoldenPathStack] Invalid WorkId "${rawWorkId}". ` +
          `Expected format: ${props.workIdPrefix}-<number> (e.g. ${props.workIdPrefix}-123)`
      );
    }

    this.workId = rawWorkId;

    // Mandatory cost allocation / ownership tags applied to every resource in this stack.
    cdk.Tags.of(this).add("finops:Project", id);
    cdk.Tags.of(this).add("finops:Team", props.teamName);
    cdk.Tags.of(this).add("finops:Owner", props.ownerEmail);
    cdk.Tags.of(this).add("devex:WorkId", rawWorkId);
  }

  /**
   * Creates a CloudWatch Events rule that fires on successful stack deployment.
   * Attach downstream targets (Lambda, SNS) to capture DORA deployment events.
   */
  registerDoraDeployEvent(): cdk.aws_events.Rule {
    const rule = new cdk.aws_events.Rule(this, "DoraDeployRule", {
      eventPattern: {
        source: ["aws.cloudformation"],
        detailType: ["CloudFormation Stack Status Change"],
        detail: {
          "stack-id": [{ prefix: this.stackName }],
          "status-details": {
            status: ["UPDATE_COMPLETE", "CREATE_COMPLETE"],
          },
        },
      },
      description: `DORA deployment event for stack ${this.stackName} (WorkId: ${this.workId})`,
    });

    return rule;
  }
}
