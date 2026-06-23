import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export type TableGrantType = "read" | "write" | "readWrite";

export interface LambdaServiceProps {
  /** Logical name for the service (used in resource IDs). */
  serviceName: string;
  /** Lambda handler string, e.g. "src/handlers/api/rest/payment/create/index.handler" */
  handler: string;
  /** Path to the Lambda code asset directory. */
  codePath: string;
  /** Python runtime version. Defaults to Python 3.11. */
  runtime?: cdk.aws_lambda.Runtime;
  /** DynamoDB table to grant access to. */
  table?: cdk.aws_dynamodb.ITable;
  /** Type of DynamoDB access to grant. */
  tableGrantType?: TableGrantType;
  /** Additional Lambda environment variables. */
  environment?: Record<string, string>;
  /** Memory size in MB. Defaults to 256. */
  memorySize?: number;
  /** Timeout in seconds. Defaults to 30. */
  timeout?: number;
}

/**
 * Golden Path L3 Construct: Lambda + optional DynamoDB grant + CloudWatch alarms.
 *
 * This standardises the Lambda-per-service pattern across all teams. Use this instead of
 * raw `lambda.Function` to ensure:
 *  - Consistent runtime (Python 3.11 default)
 *  - CloudWatch error-rate and throttle alarms are always created
 *  - DynamoDB permissions follow least-privilege per service
 *
 * @example
 * ```typescript
 * new LambdaService(this, "PaymentService", {
 *   serviceName: "payment-create",
 *   handler: "handlers/payment/create/index.handler",
 *   codePath: "src/python",
 *   table: myTable,
 *   tableGrantType: "readWrite",
 *   environment: { TABLE_NAME: myTable.tableName },
 * });
 * ```
 */
export class LambdaService extends Construct {
  public readonly fn: cdk.aws_lambda.Function;
  public readonly errorAlarm: cdk.aws_cloudwatch.Alarm;
  public readonly throttleAlarm: cdk.aws_cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: LambdaServiceProps) {
    super(scope, id);

    const {
      serviceName,
      handler,
      codePath,
      runtime = cdk.aws_lambda.Runtime.PYTHON_3_11,
      table,
      tableGrantType = "readWrite",
      environment = {},
      memorySize = 256,
      timeout = 30,
    } = props;

    this.fn = new cdk.aws_lambda.Function(this, "Function", {
      functionName: serviceName,
      runtime,
      handler,
      code: cdk.aws_lambda.Code.fromAsset(codePath),
      environment,
      memorySize,
      timeout: cdk.Duration.seconds(timeout),
      tracing: cdk.aws_lambda.Tracing.ACTIVE,
    });

    // Grant DynamoDB access following least-privilege
    if (table) {
      if (tableGrantType === "read") {
        table.grantReadData(this.fn);
      } else if (tableGrantType === "write") {
        table.grantWriteData(this.fn);
      } else {
        table.grantReadWriteData(this.fn);
      }
    }

    // Standard CloudWatch alarms — always created so oncall has baseline visibility
    this.errorAlarm = new cdk.aws_cloudwatch.Alarm(this, "ErrorAlarm", {
      alarmName: `${serviceName}-errors`,
      metric: this.fn.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    this.throttleAlarm = new cdk.aws_cloudwatch.Alarm(this, "ThrottleAlarm", {
      alarmName: `${serviceName}-throttles`,
      metric: this.fn.metricThrottles({ period: cdk.Duration.minutes(5) }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
