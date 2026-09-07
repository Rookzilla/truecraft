import { CfnParameter } from 'aws-cdk-lib'
import type { Construct } from 'constructs'

export function createStackParameters(scope: Construct) {
  const notificationEmail = new CfnParameter(scope, 'NotificationEmail', {
    type: 'String',
    default: 'notifications@example.com',
    description: 'Email address that receives formatted website submission notifications.',
  })

  const adminPasswordHash = new CfnParameter(scope, 'AdminPasswordHash', {
    type: 'String',
    noEcho: true,
    allowedPattern: '^pbkdf2\\$sha256\\$[0-9]+\\$[A-Za-z0-9+/=]+\\$[A-Za-z0-9+/=]+$',
    description: 'PBKDF2 hash for the private /admin dashboard password.',
  })

  const piiEncryptionKey = new CfnParameter(scope, 'PiiEncryptionKeyBase64', {
    type: 'String',
    noEcho: true,
    minLength: 44,
    maxLength: 44,
    allowedPattern: '^[A-Za-z0-9+/]{43}=$',
    description: 'Base64-encoded 32-byte key used by Lambda for free-tier AES-256-GCM PII encryption.',
  })

  const adminAuthCallbackUrls = new CfnParameter(scope, 'AdminAuthCallbackUrls', {
    type: 'CommaDelimitedList',
    default: 'http://localhost:5173/admin',
    description: 'Comma-separated callback URLs allowed by the Cognito admin app client.',
  })

  const adminAuthLogoutUrls = new CfnParameter(scope, 'AdminAuthLogoutUrls', {
    type: 'CommaDelimitedList',
    default: 'http://localhost:5173/admin',
    description: 'Comma-separated logout URLs allowed by the Cognito admin app client.',
  })

  return {
    adminAuthCallbackUrls,
    adminAuthLogoutUrls,
    adminPasswordHash,
    notificationEmail,
    piiEncryptionKey,
  }
}
