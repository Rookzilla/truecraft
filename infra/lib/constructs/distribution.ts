import { Duration } from 'aws-cdk-lib'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Stack } from 'aws-cdk-lib'

type DistributionProps = {
  api: apigatewayv2.HttpApi
  siteBucket: s3.Bucket
}

export function createSiteDistribution(scope: Stack, props: DistributionProps) {
  const customDomainName = process.env.CUSTOM_DOMAIN_NAME
  const cloudFrontCertificateArn = process.env.CLOUDFRONT_CERTIFICATE_ARN
  const customDomainCertificate =
    customDomainName && cloudFrontCertificateArn
      ? acm.Certificate.fromCertificateArn(scope, 'CustomDomainCertificate', cloudFrontCertificateArn)
      : undefined

  const distribution = new cloudfront.Distribution(scope, 'Distribution', {
    comment: 'Truecraft static website',
    defaultRootObject: 'index.html',
    certificate: customDomainCertificate,
    domainNames: customDomainCertificate && customDomainName ? [customDomainName] : undefined,
    defaultBehavior: {
      origin: origins.S3BucketOrigin.withOriginAccessControl(props.siteBucket),
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      compress: true,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
    },
    additionalBehaviors: {
      'api/*': {
        origin: new origins.HttpOrigin(`${props.api.apiId}.execute-api.${scope.region}.${scope.urlSuffix}`),
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
    ...(customDomainCertificate
      ? { minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 }
      : {}),
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
  })

  return {
    customDomainName,
    distribution,
  }
}
