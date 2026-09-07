# AWS Static Site Deployment

## Architecture

The Vite application remains at the repository root. AWS CDK lives in
`infra/` and deploys:

- A private, encrypted S3 bucket with all public access blocked.
- A CloudFront distribution using Origin Access Control (OAC).
- A CloudFront `/api/*` behavior that forwards website submissions to an HTTP
  API.
- An API Gateway HTTP API and ARM Lambda handler for website submissions and
  the private admin dashboard.
- A private, encrypted S3 bucket for candidate CV uploads.
- A DynamoDB table for candidate/enquiry records.
- An SES email identity for formatted notification emails.
- A GuardDuty Malware Protection for S3 plan that scans uploaded CVs and writes
  the managed `GuardDutyMalwareScanStatus` object tag.
- SPA fallbacks that return `/index.html` with status `200` for S3 `403` and
  `404` responses.
- GitHub Actions uploads revalidated HTML and one-year immutable hashed
  Vite assets after CDK deploys the infrastructure.

The expected repository structure is:

```text
.
|-- .github/workflows/deploy.yml
|-- docs/AWS_DEPLOYMENT.md
|-- infra/
|   |-- bin/app.ts
|   |-- lib/static-site-stack.ts
|   |-- cdk.json
|   |-- package.json
|   |-- package-lock.json
|   `-- tsconfig.json
|-- src/
|-- package.json
|-- package-lock.json
`-- vite.config.ts
```

## Local Commands

Prerequisites: Node.js 22, AWS CLI v2, and AWS credentials for the target
account.

```bash
npm ci
npm run infra:install
npm run typecheck
npm run test --if-present
npm run lint
npm run build
npm run security:hash-admin-password
npm run security:generate-pii-key
npm run cdk:synth
npm run cdk:deploy -- \
  --parameters AdminPasswordHash="pbkdf2-sha256-hash-from-security-script" \
  --parameters PiiEncryptionKeyBase64="base64-32-byte-key-from-security-script" \
  --parameters NotificationEmail="notifications@example.com" \
  --require-approval never \
  --outputs-file cdk-outputs.json
```

For a local deployment, read `SiteBucketName` and `DistributionId` from
`infra/cdk-outputs.json`, then upload the build:

```bash
aws s3 sync dist s3://BUCKET_NAME \
  --delete \
  --exclude "assets/*" \
  --cache-control "no-cache, no-store, must-revalidate"

aws s3 sync dist/assets s3://BUCKET_NAME/assets \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"
```

To remove the personal/dev stack, empty the bucket first because the stack
deliberately contains no auto-delete Lambda:

```bash
aws s3 rm s3://BUCKET_NAME --recursive
npm run cdk:destroy -- --force
```

The deploy command writes and prints the `CloudFrontUrl` stack output.
CloudFront can take several minutes to finish its first global deployment.

### Backend and admin notes

- The admin dashboard is available at `/admin`.
- Deployed admin access uses Cognito Hosted UI login. API Gateway validates the
  Cognito JWT before forwarding `/api/admin/*` requests to Lambda.
- The legacy direct-Lambda password fallback keeps only a PBKDF2 hash in the
  `AdminPasswordHash` CloudFormation parameter.
- Generate the fallback hash with `npm run security:hash-admin-password`. Set
  `ADMIN_PASSWORD` in the shell first to avoid passing the password as a
  command-line argument.
- PII fields in DynamoDB are encrypted by the Lambda with AES-256-GCM. Generate
  the required 32-byte base64 key with `npm run security:generate-pii-key` and
  pass it through the `PiiEncryptionKeyBase64` CloudFormation parameter.
- The notification address is configured with the `NotificationEmail` parameter.
  Use a verified SES mailbox for real deployments.
- SES creates an email identity for `NotificationEmail`. AWS sends a
  verification email to that address; notifications will not send until the
  verification link is accepted.
- If the SES account is still in sandbox mode, sending is limited to verified
  addresses. That is acceptable for this first test setup because the sender
  and recipient are the same verified email identity.
- CVs are stored privately. The dashboard requests a short-lived S3 download
  URL only after GuardDuty has tagged the object as `NO_THREATS_FOUND`.
- Cancelled or accepted candidate records can be permanently deleted from the dashboard.
  Deletion removes the DynamoDB record and all versions/delete markers for any
  attached CV object.
- Accepted candidates can be moved back to the potential pool from the
  dashboard, which clears their approval timestamp.
- CV uploads use short-lived signed S3 upload URLs. This avoids routing 10 MB
  CV files through API Gateway and keeps the 10 MB limit practical.
- Uploads are limited to PDF or DOCX and 10 MB in both the browser and Lambda.
- The Lambda also tracks monthly uploaded CV bytes and rejects new CV uploads
  after 1 GB/month to stay aligned with GuardDuty Malware Protection for S3's
  monthly free scanning allowance.

### Custom domain without Route 53

To keep the setup close to free tier, the stack can attach a custom CloudFront
domain without creating a Route 53 hosted zone. Use GoDaddy for DNS and AWS ACM
for the CloudFront certificate.

Recommended first domain:

```text
www.truecraft.work
```

Use `www.truecraft.work` because GoDaddy can create a normal CNAME for `www`.
The apex domain `truecraft.work` can then forward to `https://www.truecraft.work`
in GoDaddy.

1. In AWS Certificate Manager, switch to `us-east-1`.
2. Request a public certificate for `www.truecraft.work`.
3. Choose DNS validation.
4. Copy ACM's DNS validation CNAME into GoDaddy DNS.
5. Wait until the ACM certificate status is `Issued`.
6. Copy the certificate ARN.
7. Add these GitHub production environment variables:

```text
CUSTOM_DOMAIN_NAME=www.truecraft.work
CLOUDFRONT_CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/...
```

8. Push to `main` or run the deploy workflow manually.
9. After deploy, add this GoDaddy DNS record:

```text
Type: CNAME
Name: www
Value: your-distribution-id.cloudfront.net
```

CloudFront custom domains require a valid certificate that covers the alternate
domain name. For CloudFront, ACM certificates must be requested in `us-east-1`.

## One-Time AWS Setup

Set shell variables first:

```bash
export AWS_ACCOUNT_ID="123456789012"
export AWS_REGION="eu-west-2"
export GITHUB_OWNER="your-github-user-or-org"
export GITHUB_REPOSITORY="truecraft"
export AWS_ROLE_NAME="truecraft-main-deploy"
```

PowerShell equivalent:

```powershell
$env:AWS_ACCOUNT_ID = "123456789012"
$env:AWS_REGION = "eu-west-2"
$env:GITHUB_OWNER = "your-github-user-or-org"
$env:GITHUB_REPOSITORY = "truecraft"
$env:AWS_ROLE_NAME = "truecraft-main-deploy"
```

### 1. Bootstrap CDK

Run this once per AWS account and region using an administrator or dedicated
bootstrap identity:

```bash
npx aws-cdk@2 bootstrap "aws://$AWS_ACCOUNT_ID/$AWS_REGION" \
  --qualifier truecraft \
  --toolkit-stack-name TruecraftToolkit
```

PowerShell:

```powershell
npx aws-cdk@2 bootstrap `
  "aws://$env:AWS_ACCOUNT_ID/$env:AWS_REGION" `
  --qualifier truecraft `
  --toolkit-stack-name TruecraftToolkit
```

The CDK application uses the matching `truecraft` qualifier. This creates
namespaced bootstrap roles such as `cdk-truecraft-deploy-*` rather than using
the account-wide default `cdk-hnb659fds-*` names.

### 2. Add GitHub's OIDC provider

Create it once per AWS account. If it already exists, do not create a second
provider.

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

The AWS console can also create this under IAM > Identity providers. Use
`https://token.actions.githubusercontent.com` as the provider URL and
`sts.amazonaws.com` as the audience.

### 3. Create the GitHub deployment role

Create `trust-policy.json`, replacing the account, owner, and repository:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:OWNER/REPOSITORY:environment:production"
        }
      }
    }
  ]
}
```

Because the workflow uses the GitHub `production` environment, its OIDC
subject contains `environment:production`. Protect that environment so only
the `main` branch can deploy.

Create the role:

```bash
aws iam create-role \
  --role-name "$AWS_ROLE_NAME" \
  --assume-role-policy-document file://trust-policy.json
```

Create `deploy-role-policy.json`, replacing the account ID:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "UseCdkBootstrapRoles",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::123456789012:role/cdk-truecraft-*"
    },
    {
      "Sid": "ReadBootstrapVersion",
      "Effect": "Allow",
      "Action": "ssm:GetParameter",
      "Resource": "arn:aws:ssm:*:123456789012:parameter/cdk-bootstrap/truecraft/version"
    },
    {
      "Sid": "PublishStaticSite",
      "Effect": "Allow",
      "Action": [
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::truecraft-static-site-123456789012-*",
        "arn:aws:s3:::truecraft-static-site-123456789012-*/*"
      ]
    },
    {
      "Sid": "InvalidateStaticSite",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::123456789012:distribution/*"
    },
    {
      "Sid": "InspectCloudFormation",
      "Effect": "Allow",
      "Action": [
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:GetTemplate"
      ],
      "Resource": "*"
    }
  ]
}
```

Attach it:

```bash
aws iam put-role-policy \
  --role-name "$AWS_ROLE_NAME" \
  --policy-name TruecraftCdkDeployment \
  --policy-document file://deploy-role-policy.json
```

The modern CDK bootstrap roles perform CloudFormation deployment. The GitHub
role can assume those account-local roles, upload only to the Truecraft bucket,
and invalidate account-local CloudFront distributions. The default bootstrap
CloudFormation execution role is powerful; for a production AWS account,
replace its default administrator execution policy with a policy scoped to
CloudFormation, S3, CloudFront, and SSM bootstrap parameters.

### 4. Configure GitHub

Create a GitHub environment named `production` and restrict deployments to
`main`. Add these repository or environment **variables**, not AWS access-key
secrets:

```text
AWS_ACCOUNT_ID=123456789012
AWS_REGION=eu-west-2
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/truecraft-main-deploy
NOTIFICATION_EMAIL=notifications@example.com
CUSTOM_DOMAIN_NAME=www.truecraft.work
CLOUDFRONT_CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/...
```

No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` is required.

Add this GitHub environment **secret**:

```text
ADMIN_PASSWORD_HASH=pbkdf2$sha256$310000$...
PII_ENCRYPTION_KEY_BASE64=base64-32-byte-key
```

Generate those values locally:

```bash
ADMIN_PASSWORD="replace-with-a-long-private-password" npm run security:hash-admin-password
npm run security:generate-pii-key
```

You can also configure the required GitHub environment secrets from one local command with the GitHub CLI:

```sh
gh auth login
npm run security:configure-github
```

By default this targets the `production` GitHub environment used by the deployment workflow. It updates `ADMIN_PASSWORD_HASH` and creates `PII_ENCRYPTION_KEY_BASE64` only if the key is missing.

Do not rotate `PII_ENCRYPTION_KEY_BASE64` on every deploy. Existing encrypted DynamoDB records require the same key to decrypt. Intentional rotation is available with:

```sh
npm run security:configure-github -- --rotate-pii-key
```

PowerShell:

```powershell
$env:ADMIN_PASSWORD = "replace-with-a-long-private-password"
npm run security:hash-admin-password
Remove-Item Env:\ADMIN_PASSWORD
npm run security:generate-pii-key
```

The GitHub Actions deploy workflow passes `ADMIN_PASSWORD_HASH`,
`PII_ENCRYPTION_KEY_BASE64`, `NOTIFICATION_EMAIL`, `ADMIN_AUTH_CALLBACK_URLS`,
and `ADMIN_AUTH_LOGOUT_URLS` into CDK as CloudFormation parameters. It passes
`CUSTOM_DOMAIN_NAME` and `CLOUDFRONT_CERTIFICATE_ARN` as synthesis-time
environment variables, then writes `dist/config.js`, uploads the frontend
bundle, and invalidates CloudFront.

`ADMIN_AUTH_CALLBACK_URLS` and `ADMIN_AUTH_LOGOUT_URLS` must include the admin
site URL, for example `https://example.com/admin,http://localhost:5173/admin`.
If they are omitted, the workflow tries to reuse the existing
`TruecraftStaticSite.CloudFrontUrl` output and falls back to localhost for first
deployment.

## First Deployment Checklist

1. Confirm `npm ci`, typecheck, lint, and build pass locally.
2. Confirm `dist/index.html` and `dist/assets/` exist after the build.
3. Bootstrap the exact account and region used by GitHub.
4. Confirm the GitHub OIDC provider exists in that AWS account.
5. Confirm the IAM trust policy matches the repository name, case, and
   `production` environment subject exactly.
6. Create the GitHub `production` environment and its AWS variables.
7. Add the `ADMIN_PASSWORD_HASH` and `PII_ENCRYPTION_KEY_BASE64` environment
   secrets and optional `NOTIFICATION_EMAIL`, `CUSTOM_DOMAIN_NAME`, and
   `CLOUDFRONT_CERTIFICATE_ARN` environment variables.
8. Add optional `ADMIN_AUTH_CALLBACK_URLS` and `ADMIN_AUTH_LOGOUT_URLS`
   variables when the production admin URL is known.
9. Commit the root package files, `.github/`, `docs/`, and all of `infra/`.
10. Push to `main` or manually run the workflow.
11. Read `TruecraftStaticSite.CloudFrontUrl`, `AdminUserPoolId`,
   `AdminUserPoolClientId`, and `AdminAuthUrl` from the deploy log or
   CloudFormation stack outputs.
12. Create the first Cognito admin user in the deployed admin user pool.
13. Open the HTTPS URL, test a hard refresh, test `/admin`, and confirm the
   Hosted UI login returns to the admin dashboard.

## Troubleshooting

### CloudFront returns 403

- Confirm the distribution origin is the S3 REST origin, not an S3 website
  endpoint.
- Confirm the generated bucket policy allows the CloudFront distribution
  service principal through OAC.
- Confirm `index.html` exists at the bucket root.
- Wait for the distribution deployment and invalidation to complete.
- Do not make the bucket public as a workaround.

### Vite assets do not load

- Keep Vite's default `base: "/"` for deployment at the CloudFront root.
- Check browser network requests point to `/assets/...`.
- Confirm the build ran before the S3 upload steps.
- Confirm the `assets/` prefix exists in S3 with the hashed files.
- Invalidate CloudFront after correcting a bad deployment:

```bash
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"
```

### React routes fail on refresh

- Confirm both 403 and 404 custom error responses map to `/index.html`.
- Confirm each response uses HTTP status `200` and an error-cache TTL of zero.
- If routing is hash-only, this fallback is harmless; for browser-history
  routing it is required.

### GitHub cannot assume the OIDC role

- Confirm workflow permissions include `id-token: write`.
- Confirm the provider audience and trust condition use `sts.amazonaws.com`.
- Confirm the trust-policy subject is exactly
  `repo:OWNER/REPOSITORY:environment:production`.
- Repository and owner matching is case-sensitive.
- Confirm the workflow job still declares `environment: production`.
- Confirm `AWS_ROLE_ARN` points to the role in `AWS_ACCOUNT_ID`.

### CDK bootstrap permission failure

- Bootstrap with an identity allowed to create CloudFormation, IAM roles, S3
  buckets, ECR repositories, and SSM parameters.
- Confirm the account and region in the bootstrap command match the workflow.
- Check the `CDKToolkit` stack events for the first denied API call.
- Do not bootstrap from the restricted GitHub deployment role.

## Cost Expectations

This architecture has no compute. Charges are based mainly on S3
storage/requests and CloudFront requests/data transfer. A low-traffic personal
site is normally pennies or may fit within applicable AWS free-tier
allowances, but the free tier depends on account age and AWS's current pricing.

Use CloudFront `PRICE_CLASS_100`, retain immutable asset caching, avoid
frequent unnecessary invalidations, delete unused stacks, and create an AWS
Budget with email alerts at a small threshold such as USD 1 and USD 5.
CloudFront invalidations beyond the monthly free allowance and high traffic
can generate charges. AWS WAF, access logging, Route 53 hosted zones, and extra
services are intentionally not enabled here.

## Production Changes

Before treating the stack as production:

- Change the bucket removal policy from `DESTROY` to `RETAIN`.
- Restrict the bootstrap CloudFormation execution policy.
- Add AWS Budgets and operational monitoring.
- Consider deployment approvals on the GitHub `production` environment.
- Move encryption material and admin credentials into Secrets Manager or SSM
  Parameter Store if the budget allows managed secret storage.
