# AI Product Development Lifecycle

This document describes how AI-assisted delivery is expected to work in this repository. It is written as a practical operating model for planning, implementation, testing, review, documentation, and release.

The repository rules for AI agents are in [`../AGENTS.md`](../AGENTS.md).

## Purpose

TrueCraft uses AI assistance as an engineering accelerator, not as a replacement for requirements, tests, review, or security judgement.

The expected outcome is traceable work:

- Requirements are expressed as user-visible behavior.
- Security and data handling assumptions are explicit.
- Unit and E2E tests prove important behavior.
- Infrastructure changes can be reviewed through CDK synth output.
- Documentation is updated when runtime behavior, deployment, or operations change.

## Lifecycle

### 1. Requirements Framing

Before implementation, define:

- The user, admin, or operator workflow being changed.
- The data involved, especially PII, credentials, CV metadata, or uploaded files.
- Acceptance criteria that can be tested.
- Relevant non-functional requirements: security, accessibility, reliability, performance, and deployability.

For security-sensitive changes, also state the threat being reduced. Examples in this repo include plaintext PII in DynamoDB, unencrypted S3 uploads, weak admin credential comparison, and unsafe CV download access.

### 2. BDD Scenarios

User-critical workflows should be described in Gherkin under [`features/`](features/).

BDD scenarios are not a substitute for automated tests. They exist to make intent reviewable before code is written and to stop tests drifting into implementation trivia.

Current scenarios:

- [`features/secure-candidate-submission.feature`](features/secure-candidate-submission.feature)

### 3. TDD Loop

Use Vitest for focused unit coverage:

- React behavior and accessibility assertions with Testing Library.
- Form validation and submission states.
- Backend validation, auth, encryption, decryption, hashing, and failure paths.
- Utility functions where behavior matters.

The TDD expectation is:

- Add or update a test for the behavior.
- Confirm it would fail against the old behavior where practical.
- Implement the smallest production change that satisfies the behavior.
- Keep assertions meaningful and avoid mocks that bypass the logic under test.

### 4. E2E Coverage

Use Playwright for browser-level journeys that matter to a user or reviewer:

- Page load and navigation.
- Candidate enquiry workflow.
- Form validation and success/error states.
- Admin dashboard access paths where an environment can support them.

E2E tests should cover integration behavior, not duplicate every unit test.

### 5. Implementation

Implementation should follow the existing repo shape:

- React, TypeScript, Vite, and React Bootstrap for the frontend.
- Node.js 22 Lambda code for backend submission handling.
- AWS CDK TypeScript for infrastructure.
- DynamoDB, S3, API Gateway, Lambda, SES, and GuardDuty Malware Protection for S3.

Keep changes small and reviewable. Avoid adding frameworks, services, or abstractions unless they remove real complexity or map to a clear requirement.

### 6. Security Review

Security-sensitive work must check:

- PII is not logged.
- Secrets are not committed.
- Admin credentials are hash-verified with constant-time comparison.
- Sensitive DynamoDB fields remain encrypted at application level.
- CV objects stay private.
- Presigned URLs are short-lived.
- CV downloads remain blocked until malware scanning passes.
- S3 uploads to `incoming/*` require server-side encryption.
- IAM permissions are least-privilege for the Lambda's actual work.

This repo deliberately uses a free-tier-friendly security model. Paid AWS best-practice upgrades are documented in [`../README.md`](../README.md), but not claimed as implemented unless code and infrastructure exist.

### 7. Verification

Run the narrowest useful checks while developing. Before handoff, run the full relevant set when feasible:

```sh
npm test
npm run test:coverage
npm run typecheck
npm run lint
npm run build
npm --prefix infra run typecheck
npm --prefix infra run synth
npm run test:e2e
```

If a check cannot be run, document the reason.

### 8. Review And Release

Before merging or deploying:

- Review the diff for unrelated changes.
- Confirm README or deployment docs are updated when commands, secrets, AWS resources, or security posture changed.
- Confirm GitHub environment secrets are documented for deployment.
- Confirm CDK synth succeeds for infrastructure changes.
- Confirm any migration or key-rotation notes are present for encryption/auth changes.

## Anti-Gaming Controls

AI-assisted changes must not pass by weakening the evidence.

Do not:

- Delete, skip, or loosen tests to make a change pass.
- Mock the exact behavior being verified.
- Add production code branches that exist only for tests.
- Hide TypeScript, lint, or runtime errors without a documented reason.
- Claim paid AWS services such as KMS, Secrets Manager, Cognito, WAF, or CloudFront are implemented unless they are present in the repo.

Do:

- Test negative paths as well as happy paths.
- Prefer visible behavior and API contracts over implementation details.
- Keep security claims tied to files, tests, and CDK resources.
- Document free-tier compromises and paid alternatives separately.

## Interview Mapping

This repository demonstrates:

- TypeScript and React frontend delivery.
- Node.js backend API behavior in Lambda.
- AWS CDK infrastructure as code.
- S3, DynamoDB, Lambda, API Gateway, SES, and GuardDuty Malware Protection for S3.
- Application-level PII encryption with AES-256-GCM.
- Hashed admin password verification with constant-time comparison.
- Vitest unit testing and Playwright E2E testing.
- AI-assisted delivery governance through `AGENTS.md`, BDD scenarios, and this lifecycle document.

It does not claim to be a NestJS, Next.js, Aurora MySQL, Redis, OpenSearch, Cognito, WAF, or Secrets Manager implementation. Those are documented as relevant paid or larger-platform evolution points, not as features already built here.
