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
- Amazon DynamoDB
- Amazon S3
- Amazon SES
- Amazon GuardDuty Malware Protection for S3
- Vitest and Testing Library for unit tests
- Playwright for E2E tests
- Gherkin BDD documentation for security-critical workflows

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

## Security Implementation

This repository includes a free-tier-friendly security implementation. It intentionally avoids customer-managed KMS keys and Secrets Manager so that the site remains deployable at very low cost.

### Encrypted Fields

These DynamoDB attributes are encrypted before storage:

- `name`
- `email`
- `phone`
- `role`
- `company`
- `jobTitle`
- `message`
- `notes`

Each encrypted value is stored as a JSON envelope containing:

- `v`: encryption envelope version.
- `alg`: currently `aes-256-gcm`.
- `iv`: base64 initialization vector.
- `tag`: base64 authentication tag.
- `data`: base64 ciphertext.

These operational attributes remain plaintext so the backend can route, sort, filter, and manage records without decrypting everything:

- `id`
- `type`
- `monthKey`
- `createdAt`
- `updatedAt`
- `approvedAt`
- `status`
- `scanStatus`
- `tags`
- `cvKey`
- `cvFilename`
- `cvMimeType`
- `cvSize`
- `piiEncryptionVersion`
- `emailHash`

`emailHash` is generated with HMAC-SHA256 using the same free-tier PII key. It supports exact-match lookup patterns without storing the email address in plaintext.

### S3 Upload Enforcement

The CV bucket uses S3-managed encryption and has a bucket policy that denies `s3:PutObject` to `incoming/*` unless the request includes:

```text
x-amz-server-side-encryption: AES256
```

The bucket also denies non-TLS access through CDK's `enforceSSL` policy. The Lambda and presigned upload flow both request `AES256`, so compliant uploads continue to work while accidental unencrypted writes are blocked at the bucket boundary.

### Admin Authentication

The deployed admin flow uses:

- Amazon Cognito user pool with self-signup disabled.
- Cognito Hosted UI authorization-code flow with PKCE.
- API Gateway HTTP API JWT authorizer on `/api/admin/*`.
- Browser-held session storage for the short-lived Cognito access token.
- Optional authenticator-app MFA for admin users.

The legacy direct-Lambda fallback still supports password verification using:

- PBKDF2
- SHA-256
- 310,000 iterations
- random 16-byte salt
- 32-byte derived key
- constant-time comparison with `timingSafeEqual`

The stored hash format is:

```text
pbkdf2$sha256$310000$base64-salt$base64-hash
```

This keeps the raw fallback password out of CloudFormation parameters, Lambda environment variables, and source code.

### Compatibility With Existing Records

The decrypt helper falls back to returning plaintext if a value is not an encryption envelope. That means older records written before field-level encryption can still be displayed in the admin dashboard. New records are encrypted before storage.

### Remaining Free-Tier Limitations

- The PII encryption key is still a Lambda environment variable.
- There is no automatic secret rotation.
- MFA and per-admin identity are available through Cognito, but first admin users still need to be created operationally.
- Randomized encryption prevents partial text search over encrypted fields.
- CloudFormation no-echo parameters reduce display exposure but are not a full secret-management system.

## Paid Security Options Not In This Repo

The repository does not implement these paid controls. They are listed here only to show the next security upgrades available with additional AWS budget.

### 1. Customer-Managed KMS Keys

- Create one or more customer-managed KMS keys with automatic rotation enabled.
- Use KMS encryption for the CV S3 bucket.
- Enable S3 Bucket Keys to reduce SSE-KMS request costs.
- Use customer-managed KMS encryption for the DynamoDB table.
- Use a dedicated KMS key for application-level envelope encryption.
- Scope key policies tightly to the Lambda role and required AWS services.
- Use KMS encryption context, for example:

```json
{
  "purpose": "truecraft-submission-pii",
  "submissionId": "submission-id"
}
```

Benefits:

- Customer-owned key lifecycle and rotation.
- CloudTrail visibility into key usage.
- Fine-grained IAM/key policy controls.
- Stronger separation of duties between data access and key access.

Cost note:

- Customer-managed AWS KMS keys have a monthly key charge and can also incur request charges. See [AWS KMS pricing](https://aws.amazon.com/kms/pricing/).

### 2. Envelope Encryption For PII

- Use KMS `GenerateDataKey` per submission or per logical record group.
- Encrypt sensitive fields locally with AES-256-GCM.
- Store the encrypted data key beside the encrypted fields.
- Decrypt the data key only when the admin API needs to render plaintext.
- Use KMS encryption context to bind ciphertext to the expected submission/purpose.
- Cache decrypted data keys only within a single Lambda invocation when necessary.

Benefits:

- KMS never handles the full PII payload.
- Each record can have its own data key.
- Key usage is auditable through KMS and CloudTrail.
- A DynamoDB read alone is insufficient to recover PII.

### 3. Secrets Manager Or SSM Parameter Store

- Store admin credentials and encryption material outside Lambda environment variables.
- Prefer AWS Secrets Manager for secrets that need managed rotation.
- Use SSM Parameter Store SecureString for simpler lower-cost secret storage when rotation is not required.
- Cache secrets in the Lambda execution environment to avoid retrieving them on every request.
- Grant the Lambda role permission to read only the specific secret/parameter ARN.

Benefits:

- Better secret lifecycle management.
- Cleaner separation from deployment configuration.
- Easier rotation path.
- Reduced risk of accidental plaintext exposure in CloudFormation outputs or Lambda configuration review.

Cost note:

- AWS Secrets Manager has per-secret and API request charges outside applicable free credits/trials. See [AWS Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/).

### 4. Real Admin Identity

- Replace the shared `x-admin-password` model with a real identity provider.
- Use one of:
  - Amazon Cognito,
  - IAM Identity Center,
  - Auth0,
  - another OIDC provider.
- Add MFA.
- Issue short-lived sessions or JWTs.
- Add API authorization middleware or an API Gateway authorizer.
- Track admin identity in update audit records.

Benefits:

- No shared password.
- MFA support.
- Per-user access control.
- Per-user audit trail.
- Better offboarding.

### 5. Stronger Monitoring And Audit

- CloudTrail data events for S3 object access.
- CloudWatch alarms for unusual admin/API activity.
- AWS WAF in front of CloudFront/API routes.
- Security Hub and GuardDuty findings review.
- Explicit CloudWatch log retention policies.
- Structured security events with PII redaction.

Benefits:

- Better incident detection.
- Better audit evidence.
- Reduced sensitive log retention risk.
