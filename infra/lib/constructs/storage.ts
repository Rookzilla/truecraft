import { RemovalPolicy, Stack } from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'

export function createStorageResources(scope: Stack) {
  const siteBucket = new s3.Bucket(scope, 'SiteBucket', {
    bucketName: `truecraft-static-site-${scope.account}-${scope.region}`,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    versioned: false,
    // Personal/dev setting. Use RETAIN before treating this as production data.
    removalPolicy: RemovalPolicy.DESTROY,
  })

  const cvBucket = new s3.Bucket(scope, 'CvBucket', {
    bucketName: `truecraft-cv-submissions-${scope.account}-${scope.region}`,
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

  cvBucket.addToResourcePolicy(
    new iam.PolicyStatement({
      sid: 'DenyUnencryptedIncomingCvUploads',
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ['s3:PutObject'],
      resources: [cvBucket.arnForObjects('incoming/*')],
      conditions: {
        StringNotEquals: {
          's3:x-amz-server-side-encryption': 'AES256',
        },
      },
    }),
  )

  const submissionsTable = new dynamodb.Table(scope, 'SubmissionsTable', {
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    encryption: dynamodb.TableEncryption.AWS_MANAGED,
    partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    pointInTimeRecoverySpecification: {
      pointInTimeRecoveryEnabled: false,
    },
    // Personal/dev setting. Use RETAIN before treating this as production data.
    removalPolicy: RemovalPolicy.DESTROY,
  })

  return {
    cvBucket,
    siteBucket,
    submissionsTable,
  }
}
