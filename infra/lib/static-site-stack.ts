import { Stack, type StackProps } from 'aws-cdk-lib'
import * as ses from 'aws-cdk-lib/aws-ses'
import type { Construct } from 'constructs'
import { createAdminAuth } from './constructs/admin-auth'
import { createSiteDistribution } from './constructs/distribution'
import { createCvMalwareProtection } from './constructs/malware-protection'
import { createStackOutputs } from './constructs/outputs'
import { createStackParameters } from './constructs/parameters'
import { createStorageResources } from './constructs/storage'
import { createSubmissionApi } from './constructs/submission-api'

export class StaticSiteStack extends Stack {
  public constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const { adminAuthCallbackUrls, adminAuthLogoutUrls, adminPasswordHash, notificationEmail, piiEncryptionKey } = createStackParameters(this)
    const { cvBucket, siteBucket, submissionsTable } = createStorageResources(this)
    const { authBaseUrl, userPool, userPoolClient } = createAdminAuth(this, {
      callbackUrls: adminAuthCallbackUrls,
      logoutUrls: adminAuthLogoutUrls,
    })

    const notificationIdentity = new ses.EmailIdentity(this, 'NotificationEmailIdentity', {
      identity: ses.Identity.email(notificationEmail.valueAsString),
    })

    const { api } = createSubmissionApi(this, {
      adminPasswordHash,
      adminUserPool: userPool,
      adminUserPoolClient: userPoolClient,
      cvBucket,
      notificationEmail,
      notificationIdentity,
      piiEncryptionKey,
      submissionsTable,
    })

    createCvMalwareProtection(this, cvBucket)

    const { customDomainName, distribution } = createSiteDistribution(this, {
      api,
      siteBucket,
    })

    createStackOutputs(this, {
      adminUserPool: userPool,
      adminUserPoolClient: userPoolClient,
      api,
      authBaseUrl,
      customDomainName,
      cvBucket,
      distribution,
      siteBucket,
    })
  }
}
