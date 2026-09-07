#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { StaticSiteStack } from '../lib/static-site-stack'

const app = new cdk.App()

new StaticSiteStack(app, 'TruecraftStaticSite', {
  synthesizer: new cdk.DefaultStackSynthesizer({
    qualifier: 'truecraft',
  }),
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-2',
  },
  description: 'Private S3 and CloudFront hosting for the Truecraft static site',
})
