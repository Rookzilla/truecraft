import { Duration, RemovalPolicy } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import type { CfnParameter } from 'aws-cdk-lib'
import type { Construct } from 'constructs'

type AdminAuthProps = {
  callbackUrls: CfnParameter
  logoutUrls: CfnParameter
}

export function createAdminAuth(scope: Construct, props: AdminAuthProps) {
  const userPool = new cognito.UserPool(scope, 'AdminUserPool', {
    accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    mfa: cognito.Mfa.OPTIONAL,
    mfaSecondFactor: {
      otp: true,
      sms: false,
    },
    passwordPolicy: {
      minLength: 14,
      requireDigits: true,
      requireLowercase: true,
      requireSymbols: true,
      requireUppercase: true,
      tempPasswordValidity: Duration.days(7),
    },
    removalPolicy: RemovalPolicy.RETAIN,
    selfSignUpEnabled: false,
    signInAliases: {
      email: true,
    },
    standardAttributes: {
      email: {
        required: true,
        mutable: true,
      },
    },
  })

  const userPoolClient = userPool.addClient('AdminUserPoolClient', {
    authFlows: {
      userSrp: true,
    },
    disableOAuth: false,
    generateSecret: false,
    oAuth: {
      callbackUrls: props.callbackUrls.valueAsList,
      flows: {
        authorizationCodeGrant: true,
      },
      logoutUrls: props.logoutUrls.valueAsList,
      scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
    },
    preventUserExistenceErrors: true,
  })

  const region = process.env.CDK_DEFAULT_REGION ?? 'eu-west-2'
  const account = process.env.CDK_DEFAULT_ACCOUNT ?? 'local'
  const domain = userPool.addDomain('AdminUserPoolDomain', {
    cognitoDomain: {
      domainPrefix: `truecraft-admin-${account}-${region}`,
    },
  })

  return {
    authBaseUrl: `https://${domain.domainName}.auth.${region}.amazoncognito.com`,
    userPool,
    userPoolClient,
  }
}
