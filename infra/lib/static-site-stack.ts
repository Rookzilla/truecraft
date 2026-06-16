import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'

export class StaticSiteStack extends Stack {
  public constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `truecraft-static-site-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      // Personal/dev setting. Use RETAIN before treating this as production data.
      removalPolicy: RemovalPolicy.DESTROY,
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
  }
}
