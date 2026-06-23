import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export type DoraMetric =
  | "DeploymentFrequency"
  | "LeadTimeForChanges"
  | "ChangeFailureRate"
  | "MTTR";

/**
 * Standard dimensions attached to every DORA metric emitted from this framework.
 * Using the same dimensions across all teams ensures metrics are comparable in
 * CloudWatch Insights and cross-team dashboards
 */
export interface DoraDimensions {
  /** Logical team name (e.g. "payments", "identity"). Used as the CloudWatch dimension. */
  teamName: string;
  /** Work ID prefix for this team (e.g. "FIN", "PLAT"). */
  workIdPrefix: string;
}

/**
 * Creates a CloudWatch Events rule that captures CloudFormation stack deployment events.
 * Wire a Lambda or SNS topic to this rule to persist DORA deployment records.
 */
export function createDoraDeploymentRule(
  scope: Construct,
  id: string,
): cdk.aws_events.Rule {
  return new cdk.aws_events.Rule(scope, id, {
    description:
      "Capture CloudFormation deployment completions for DORA metrics",
    eventPattern: {
      source: ["aws.cloudformation"],
      detailType: ["CloudFormation Stack Status Change"],
      detail: {
        "status-details": {
          status: ["UPDATE_COMPLETE", "CREATE_COMPLETE"],
        },
      },
    },
  });
}

/**
 * Create a standard CloudWatch alarm for a DORA metric threshold breach.
 * Alarms are scoped to a specific team via `dimensions.teamName` so that
 * each team owns its own alert without polluting the platform-wide view.
 *
 * @param scope CDK construct scope
 * @param metric Which DORA metric to alarm on
 * @param threshold Alert threshold value
 * @param dimensions Team identity dimensions for metric scoping
 */
export function createDoraAlarm(
  scope: Construct,
  metric: DoraMetric,
  threshold: number,
  dimensions: DoraDimensions,
): cdk.aws_cloudwatch.Alarm {
  const cwMetric = new cdk.aws_cloudwatch.Metric({
    namespace: "DevEx/DORA",
    metricName: metric,
    period: cdk.Duration.days(7),
    statistic: "Average",
    dimensionsMap: {
      TeamName: dimensions.teamName,
      WorkIdPrefix: dimensions.workIdPrefix,
    },
  });

  return new cdk.aws_cloudwatch.Alarm(scope, `DoraAlarm${metric}`, {
    alarmName: `devex-dora-${dimensions.teamName}-${metric.toLowerCase()}`,
    metric: cwMetric,
    threshold,
    evaluationPeriods: 1,
    comparisonOperator:
      cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
  });
}

/**
 * Emit DORA deployment metrics to CloudWatch from CI scripts.
 * Called after a successful deployment; records lead time and deployment timestamp.
 *
 * All metrics are tagged with `TeamName` and `WorkIdPrefix` dimensions so that
 * a single CloudWatch dashboard can compare any two teams side by side, regardless
 * of whether they run Python, TypeScript, Go, or any other language stack.
 *
 * Requires AWS SDK v3 (`@aws-sdk/client-cloudwatch`) to be available at runtime.
 *
 * @param commitSha The git SHA that was deployed
 * @param deployTime The timestamp of the deployment
 * @param dimensions Team identity dimensions for metric scoping
 * @param leadTimeHours Pre-computed lead time (first commit → deploy), in hours
 */
export async function emitLeadTimeMetric(
  commitSha: string,
  deployTime: Date,
  dimensions: DoraDimensions,
  leadTimeHours: number,
): Promise<void> {
  const { CloudWatchClient, PutMetricDataCommand } =
    await import("@aws-sdk/client-cloudwatch");

  const cwDimensions = [
    { Name: "TeamName", Value: dimensions.teamName },
    { Name: "WorkIdPrefix", Value: dimensions.workIdPrefix },
  ];

  const client = new CloudWatchClient({});
  await client.send(
    new PutMetricDataCommand({
      Namespace: "DevEx/DORA",
      MetricData: [
        {
          MetricName: "DeploymentFrequency",
          Value: 1,
          Unit: "Count",
          Timestamp: deployTime,
          Dimensions: cwDimensions,
        },
        {
          MetricName: "LeadTimeForChanges",
          Value: leadTimeHours,
          Unit: "None",
          Timestamp: deployTime,
          Dimensions: [
            ...cwDimensions,
            { Name: "CommitSha", Value: commitSha.substring(0, 8) },
          ],
        },
      ],
    }),
  );
}
