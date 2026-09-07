import { CfnOutput } from 'aws-cdk-lib'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'

type OutputProps = {
  api: apigatewayv2.HttpApi
  authBaseUrl: string
  adminUserPoolClient: cognito.IUserPoolClient
  adminUserPool: cognito.IUserPool
  customDomainName?: string
  cvBucket: s3.Bucket
  distribution: cloudfront.Distribution
  siteBucket: s3.Bucket
}

export function createStackOutputs(scope: Construct, props: OutputProps) {
  new CfnOutput(scope, 'CloudFrontUrl', {
    description: 'Public website URL',
    value: `https://${props.distribution.distributionDomainName}`,
  })

  if (props.customDomainName) {
    new CfnOutput(scope, 'CustomDomainUrl', {
      description: 'Custom website URL',
      value: `https://${props.customDomainName}`,
    })
  }

  new CfnOutput(scope, 'DistributionId', {
    description: 'CloudFront distribution ID',
    value: props.distribution.distributionId,
  })

  new CfnOutput(scope, 'SiteBucketName', {
    description: 'Private deployment bucket name',
    value: props.siteBucket.bucketName,
  })

  new CfnOutput(scope, 'SubmissionsApiUrl', {
    description: 'HTTP API URL for website submissions',
    value: props.api.apiEndpoint,
  })

  new CfnOutput(scope, 'CvBucketName', {
    description: 'Private bucket for candidate CV uploads',
    value: props.cvBucket.bucketName,
  })

  new CfnOutput(scope, 'AdminAuthUrl', {
    description: 'Cognito Hosted UI base URL for admin login',
    value: props.authBaseUrl,
  })

  new CfnOutput(scope, 'AdminUserPoolClientId', {
    description: 'Cognito app client ID used by the admin UI',
    value: props.adminUserPoolClient.userPoolClientId,
  })

  new CfnOutput(scope, 'AdminUserPoolId', {
    description: 'Cognito user pool ID for admin users',
    value: props.adminUserPool.userPoolId,
  })
}
