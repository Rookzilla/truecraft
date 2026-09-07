import { Duration } from 'aws-cdk-lib'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as ses from 'aws-cdk-lib/aws-ses'
import { join } from 'node:path'
import type { CfnParameter } from 'aws-cdk-lib'
import type { Construct } from 'constructs'

type SubmissionApiProps = {
  adminPasswordHash: CfnParameter
  adminUserPool: cognito.IUserPool
  adminUserPoolClient: cognito.IUserPoolClient
  cvBucket: s3.Bucket
  notificationEmail: CfnParameter
  notificationIdentity: ses.EmailIdentity
  piiEncryptionKey: CfnParameter
  submissionsTable: dynamodb.Table
}

export function createSubmissionApi(scope: Construct, props: SubmissionApiProps) {
  const submissionsFunction = new nodejs.NodejsFunction(scope, 'SubmissionsFunction', {
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: lambda.Architecture.ARM_64,
    entry: join(__dirname, '..', '..', 'lambda', 'submissions.mjs'),
    handler: 'handler',
    timeout: Duration.seconds(20),
    memorySize: 256,
    bundling: {
      externalModules: [],
      minify: true,
      sourceMap: false,
    },
    environment: {
      ADMIN_PASSWORD_HASH: props.adminPasswordHash.valueAsString,
      CV_BUCKET_NAME: props.cvBucket.bucketName,
      MAX_FILE_BYTES: String(10 * 1024 * 1024),
      MONTHLY_SCAN_BYTES_CAP: String(1024 * 1024 * 1024),
      NOTIFICATION_EMAIL: props.notificationEmail.valueAsString,
      PII_ENCRYPTION_KEY_BASE64: props.piiEncryptionKey.valueAsString,
      SENDER_EMAIL: props.notificationEmail.valueAsString,
      TABLE_NAME: props.submissionsTable.tableName,
    },
  })

  props.submissionsTable.grantReadWriteData(submissionsFunction)
  submissionsFunction.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['s3:DeleteObject', 's3:DeleteObjectVersion', 's3:GetObject', 's3:GetObjectTagging', 's3:PutObject'],
      resources: [`${props.cvBucket.bucketArn}/incoming/*`],
    }),
  )
  submissionsFunction.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['s3:ListBucketVersions'],
      resources: [props.cvBucket.bucketArn],
    }),
  )
  props.notificationIdentity.grantSendEmail(submissionsFunction)

  const api = new apigatewayv2.HttpApi(scope, 'SubmissionsApi', {
    apiName: 'truecraft-submissions',
    corsPreflight: {
      allowHeaders: ['authorization', 'content-type', 'x-admin-password'],
      allowMethods: [
        apigatewayv2.CorsHttpMethod.DELETE,
        apigatewayv2.CorsHttpMethod.GET,
        apigatewayv2.CorsHttpMethod.PATCH,
        apigatewayv2.CorsHttpMethod.POST,
        apigatewayv2.CorsHttpMethod.OPTIONS,
      ],
      allowOrigins: ['*'],
      maxAge: Duration.hours(1),
    },
  })

  const integration = new integrations.HttpLambdaIntegration('SubmissionsIntegration', submissionsFunction)
  const adminAuthorizer = new authorizers.HttpUserPoolAuthorizer('AdminUserPoolAuthorizer', props.adminUserPool, {
    userPoolClients: [props.adminUserPoolClient],
  })

  api.addRoutes({
    path: '/api/submissions',
    methods: [apigatewayv2.HttpMethod.POST],
    integration,
  })

  api.addRoutes({
    path: '/api/submissions/init',
    methods: [apigatewayv2.HttpMethod.POST],
    integration,
  })

  api.addRoutes({
    path: '/api/submissions/{id}/complete',
    methods: [apigatewayv2.HttpMethod.POST],
    integration,
  })

  api.addRoutes({
    path: '/api/admin/{proxy+}',
    methods: [apigatewayv2.HttpMethod.DELETE, apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PATCH, apigatewayv2.HttpMethod.POST],
    integration,
    authorizer: adminAuthorizer,
  })

  return {
    api,
    submissionsFunction,
  }
}
