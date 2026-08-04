import {
  CfnOutput,
  CfnParameter,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as guardduty from 'aws-cdk-lib/aws-guardduty'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as ses from 'aws-cdk-lib/aws-ses'
import { join } from 'node:path'
import type { Construct } from 'constructs'

export class StaticSiteStack extends Stack {
  public constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const notificationEmail = new CfnParameter(this, 'NotificationEmail', {
      type: 'String',
      default: 'andybrown7890@gmail.com',
      description: 'Email address that receives formatted website submission notifications.',
    })

    const adminPassword = new CfnParameter(this, 'AdminPassword', {
      type: 'String',
      noEcho: true,
      minLength: 12,
      description: 'Temporary private admin password for the /admin dashboard.',
    })

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `truecraft-static-site-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      // Personal/dev setting. Use RETAIN before treating this as production data.
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const cvBucket = new s3.Bucket(this, 'CvBucket', {
      bucketName: `truecraft-cv-submissions-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          maxAge: 300,
        },
      ],
      // Personal/dev setting. Use RETAIN before treating this as production data.
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const submissionsTable = new dynamodb.Table(this, 'SubmissionsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      // Personal/dev setting. Use RETAIN before treating this as production data.
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const notificationIdentity = new ses.EmailIdentity(this, 'NotificationEmailIdentity', {
      identity: ses.Identity.email(notificationEmail.valueAsString),
    })

    const submissionsFunction = new nodejs.NodejsFunction(this, 'SubmissionsFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: join(__dirname, '..', 'lambda', 'submissions.mjs'),
      handler: 'handler',
      timeout: Duration.seconds(20),
      memorySize: 256,
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: false,
      },
      environment: {
        ADMIN_PASSWORD: adminPassword.valueAsString,
        CV_BUCKET_NAME: cvBucket.bucketName,
        MAX_FILE_BYTES: String(10 * 1024 * 1024),
        MONTHLY_SCAN_BYTES_CAP: String(1024 * 1024 * 1024),
        NOTIFICATION_EMAIL: notificationEmail.valueAsString,
        SENDER_EMAIL: notificationEmail.valueAsString,
        TABLE_NAME: submissionsTable.tableName,
      },
    })

    submissionsTable.grantReadWriteData(submissionsFunction)
    cvBucket.grantReadWrite(submissionsFunction)
    submissionsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObjectTagging'],
        resources: [`${cvBucket.bucketArn}/incoming/*`],
      }),
    )
    notificationIdentity.grantSendEmail(submissionsFunction)

    const api = new apigatewayv2.HttpApi(this, 'SubmissionsApi', {
      apiName: 'truecraft-submissions',
      corsPreflight: {
        allowHeaders: ['content-type', 'x-admin-password'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: Duration.hours(1),
      },
    })

    api.addRoutes({
      path: '/api/{proxy+}',
      methods: [
        apigatewayv2.HttpMethod.GET,
        apigatewayv2.HttpMethod.PATCH,
        apigatewayv2.HttpMethod.POST,
      ],
      integration: new integrations.HttpLambdaIntegration('SubmissionsIntegration', submissionsFunction),
    })

    const malwareProtectionRole = new iam.Role(this, 'GuardDutyMalwareProtectionRole', {
      assumedBy: new iam.ServicePrincipal('malware-protection-plan.guardduty.amazonaws.com'),
    })

    malwareProtectionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowManagedRuleToSendS3EventsToGuardDuty',
        actions: ['events:PutRule', 'events:DeleteRule', 'events:PutTargets', 'events:RemoveTargets'],
        resources: [
          `arn:${this.partition}:events:${this.region}:${this.account}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*`,
        ],
        conditions: {
          StringLike: {
            'events:ManagedBy': 'malware-protection-plan.guardduty.amazonaws.com',
          },
        },
      }),
    )
    malwareProtectionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowGuardDutyToMonitorEventBridgeManagedRule',
        actions: ['events:DescribeRule', 'events:ListTargetsByRule'],
        resources: [
          `arn:${this.partition}:events:${this.region}:${this.account}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*`,
        ],
      }),
    )
    malwareProtectionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowEnableS3EventBridgeEvents',
        actions: ['s3:PutBucketNotification', 's3:GetBucketNotification'],
        resources: [cvBucket.bucketArn],
      }),
    )
    malwareProtectionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowPutValidationObject',
        actions: ['s3:PutObject'],
        resources: [`${cvBucket.bucketArn}/malware-protection-resource-validation-object`],
      }),
    )
    malwareProtectionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowCheckBucketOwnership',
        actions: ['s3:ListBucket'],
        resources: [cvBucket.bucketArn],
      }),
    )
    malwareProtectionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowMalwareScan',
        actions: ['s3:GetObject', 's3:GetObjectVersion'],
        resources: [`${cvBucket.bucketArn}/incoming/*`],
      }),
    )
    malwareProtectionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowTagScannedObjects',
        actions: ['s3:GetObjectTagging', 's3:GetObjectVersionTagging', 's3:PutObjectTagging', 's3:PutObjectVersionTagging'],
        resources: [`${cvBucket.bucketArn}/incoming/*`],
      }),
    )

    new guardduty.CfnMalwareProtectionPlan(this, 'CvMalwareProtectionPlan', {
      actions: {
        tagging: {
          status: 'ENABLED',
        },
      },
      protectedResource: {
        s3Bucket: {
          bucketName: cvBucket.bucketName,
          objectPrefixes: ['incoming/'],
        },
      },
      role: malwareProtectionRole.roleArn,
    })

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Truecraft static website',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      additionalBehaviors: {
        'api/*': {
          origin: new origins.HttpOrigin(`${api.apiId}.execute-api.${this.region}.${this.urlSuffix}`),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
      ],
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    })

    new CfnOutput(this, 'CloudFrontUrl', {
      description: 'Public website URL',
      value: `https://${distribution.distributionDomainName}`,
    })

    new CfnOutput(this, 'DistributionId', {
      description: 'CloudFront distribution ID',
      value: distribution.distributionId,
    })

    new CfnOutput(this, 'SiteBucketName', {
      description: 'Private deployment bucket name',
      value: siteBucket.bucketName,
    })

    new CfnOutput(this, 'SubmissionsApiUrl', {
      description: 'HTTP API URL for website submissions',
      value: api.apiEndpoint,
    })

    new CfnOutput(this, 'CvBucketName', {
      description: 'Private bucket for candidate CV uploads',
      value: cvBucket.bucketName,
    })
  }
}
