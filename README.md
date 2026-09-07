# TrueCraft

TrueCraft is a Vite, React, and TypeScript recruitment website with an AWS-backed candidate submission workflow. The backend supports candidate/business enquiries, CV upload via presigned S3 URLs, malware scan status tracking, email notifications, and a private admin dashboard.

AWS deployment instructions are in [`docs/AWS_DEPLOYMENT.md`](docs/AWS_DEPLOYMENT.md). AI-assisted delivery rules are in [`AGENTS.md`](AGENTS.md), with the lifecycle documented in [`docs/AI_PDLC.md`](docs/AI_PDLC.md) and BDD scenarios in [`docs/features/secure-candidate-submission.feature`](docs/features/secure-candidate-submission.feature).

## Stack

- React 19
- TypeScript
- Node.js 22 for local tooling, security scripts, AWS CDK, and Lambda runtime
- Vite
- React Bootstrap
- AWS CDK
- AWS Lambda
- Amazon API Gateway HTTP API
- Amazon Cognito
- Amazon DynamoDB
- Amazon S3
- Amazon SES
- Amazon GuardDuty Malware Protection for S3
- Vitest and Testing Library for unit tests
- Playwright for E2E tests
- Gherkin BDD documentation for security-critical workflows

<img width="1538" height="1038" alt="image" src="https://github.com/user-attachments/assets/384ace55-94d8-4d77-85b0-6368ccd9cf7b" />

## Repository Practices

- AI-assisted engineering rules: [`AGENTS.md`](AGENTS.md)
- AI Product Development Lifecycle: [`docs/AI_PDLC.md`](docs/AI_PDLC.md)
- Secure candidate submission BDD scenarios: [`docs/features/secure-candidate-submission.feature`](docs/features/secure-candidate-submission.feature)
- AWS deployment and operations guide: [`docs/AWS_DEPLOYMENT.md`](docs/AWS_DEPLOYMENT.md)

## Local Development

Install dependencies:

```sh
npm install
npm run infra:install
```

Start the frontend:

```sh
npm run dev
```

Build the frontend:

```sh
npm run build
```

Run checks:

```sh
npm test
npm run test:coverage
npm run test:e2e
npm run typecheck
npm run lint
```

`npm run test:coverage` enforces 90% minimum coverage for statements, branches, functions, and lines.

Configure GitHub deployment secrets from one local command:

```powershell
gh auth login
npm run security:configure-github
```

This updates `ADMIN_PASSWORD_HASH` in the `production` GitHub environment and creates `PII_ENCRYPTION_KEY_BASE64` only if it is missing. It does not rotate the PII key on each deploy.

Manual local generators are also available when you want to paste values yourself:

```powershell
$env:ADMIN_PASSWORD = "replace-with-a-long-private-password"
npm run security:hash-admin-password
Remove-Item Env:\ADMIN_PASSWORD
npm run security:generate-pii-key
```

To intentionally rotate the PII key:

```powershell
npm run security:configure-github -- --rotate-pii-key
```

Only rotate the PII key with a migration plan for existing encrypted DynamoDB records.

## Backend Overview

The backend lives in [`infra/lambda/submissions.mjs`](infra/lambda/submissions.mjs) and is deployed by [`infra/lib/static-site-stack.ts`](infra/lib/static-site-stack.ts).

The admin notification address is passed into the Lambda as `NOTIFICATION_EMAIL` and is also used as `SENDER_EMAIL` by default. Set it through the `NotificationEmail` deployment parameter or the `NOTIFICATION_EMAIL` GitHub Actions variable. AWS SES must verify this address in the deployment region before notification emails can be sent.

Supported API routes:

- `POST /api/submissions`: accepts JSON enquiries and legacy multipart submissions.
- `POST /api/submissions/init`: creates a candidate record and returns a presigned S3 upload URL for CVs.
- `POST /api/submissions/{id}/complete`: validates uploaded CV metadata/signature and marks the submission ready for security scanning.
- `GET /api/admin/candidates`: lists candidate submissions for the admin dashboard.
- `PATCH /api/admin/candidates/{id}`: updates candidate status, notes, or tags.
- `DELETE /api/admin/candidates/{id}`: permanently deletes a cancelled or accepted candidate record and all versions of its CV object.
- `POST /api/admin/candidates/{id}/cv-url`: returns a short-lived CV download URL after the malware scan passes.

Admin routes are protected by an API Gateway JWT authorizer backed by an Amazon Cognito user pool. Public submission routes remain open.

## Deployment Secrets

The free-tier security implementation requires these GitHub environment secrets:

- `ADMIN_PASSWORD_HASH`: PBKDF2 hash retained as a migration/local-test fallback for direct Lambda admin requests.
- `PII_ENCRYPTION_KEY_BASE64`: base64-encoded 32-byte key used for AES-256-GCM field encryption.

These values are passed into CDK as no-echo CloudFormation parameters:

- `AdminPasswordHash`
- `PiiEncryptionKeyBase64`

The deployed admin browser flow uses Cognito Hosted UI and sends `Authorization: Bearer <token>` to `/api/admin/*`. API Gateway validates the Cognito JWT before the Lambda handles the request.

For production Hosted UI redirects, set these GitHub environment variables when you know the site URL:

- `ADMIN_AUTH_CALLBACK_URLS`, for example `https://example.com/admin,http://localhost:5173/admin`
- `ADMIN_AUTH_LOGOUT_URLS`, usually the same value

If those variables are omitted, the deploy workflow tries to reuse the existing `CloudFrontUrl` stack output and falls back to `http://localhost:5173/admin`.

Generate `ADMIN_PASSWORD_HASH`:

```sh
ADMIN_PASSWORD="replace-with-a-long-private-password" npm run security:hash-admin-password
```

Generate `PII_ENCRYPTION_KEY_BASE64`:

```sh
npm run security:generate-pii-key
```

Keep `PII_ENCRYPTION_KEY_BASE64` stable. Changing it without a rotation process means existing encrypted DynamoDB fields cannot be decrypted. If rotation is needed, introduce a second key version, decrypt with the old key, re-encrypt with the new key, and update `piiEncryptionVersion` after each record is migrated.

## Security Posture

<img width="1048" height="609" alt="image" src="https://github.com/user-attachments/assets/8f27a92c-997f-4a4d-a3b9-913555ce863a" />

The security model is deliberately practical: strong controls where the app handles candidate data, while keeping the AWS footprint cheap enough to run as a small recruitment site. The detailed points are collapsed so the README stays readable.

<details>
<summary>Implemented controls</summary>

### Admin access

- `/api/admin/*` is protected by an API Gateway HTTP API JWT authorizer.
- Admin login uses Amazon Cognito Hosted UI.
- The browser uses authorization-code flow with PKCE and sends `Authorization: Bearer <token>` to admin routes.
- Cognito self-signup is disabled, so admin users have to be created intentionally.
- Authenticator-app MFA is available for admin users.
- A legacy direct-Lambda password fallback remains for local/testing paths only. It uses PBKDF2 SHA-256, 310,000 iterations, a random 16-byte salt, a 32-byte derived key, and constant-time comparison.

### Candidate data

- Sensitive DynamoDB fields are encrypted by the Lambda before storage with AES-256-GCM.
- Encrypted fields are `name`, `email`, `phone`, `role`, `company`, `jobTitle`, `message`, and `notes`.
- Each encrypted field is stored as an envelope with version, algorithm, IV, auth tag, and ciphertext.
- `emailHash` is generated with HMAC-SHA256 so exact-match lookup can work without storing plaintext email.
- Older plaintext records can still be read, but new writes use encrypted storage.

### CV storage

- CV files are uploaded directly to a private S3 bucket through short-lived presigned URLs.
- The CV bucket blocks public access, enforces SSL, uses versioning, and requires S3-managed `AES256` encryption for `incoming/*` uploads.
- Lambda requests the same `AES256` header when issuing upload URLs.
- CV download URLs are short-lived and only issued after GuardDuty Malware Protection for S3 reports `NO_THREATS_FOUND`.

### Infrastructure and deployment

<img width="920" height="446" alt="image" src="https://github.com/user-attachments/assets/20663e48-3e08-4ed3-a502-48971d11aa21" />

- The static site bucket is private and served through CloudFront Origin Access Control.
- CloudFront redirects viewers to HTTPS and uses managed security response headers.
- GitHub Actions uses OIDC role assumption rather than long-lived AWS access keys.
- Deployment secrets are passed through GitHub environment secrets and CloudFormation no-echo parameters.
- Current public examples use placeholder account IDs, distribution IDs, and email addresses.

</details>
