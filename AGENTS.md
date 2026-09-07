# Repository AI Rules

These rules apply to AI-assisted work in this repository. They are intended for Codex, Claude, Cursor, or any other agent modifying the codebase.

## Core Principles

- Prefer small, reviewable changes that match the existing React, TypeScript, Vite, AWS CDK, and Lambda patterns.
- Do not add AI authorship markers, bot signatures, or co-author trailers.
- Do not commit secrets, generated credentials, real passwords, API keys, private tokens, or personal data.
- Treat candidate submissions, CV metadata, admin credentials, encryption keys, and email addresses as sensitive.
- Preserve the free-tier security posture unless the task explicitly asks for paid AWS services.

## TDD And BDD Expectations

- Start with behavior. Describe the expected user/backend behavior before changing implementation.
- Add or update tests before or alongside implementation for every meaningful behavior change.
- For UI behavior, prefer Testing Library tests that assert visible behavior and accessible roles/text rather than implementation details.
- For backend behavior, add focused tests for validation, crypto/auth helpers, storage envelopes, and failure paths.
- For user-critical journeys, add or update Playwright E2E coverage.
- Do not make tests pass by weakening assertions, hiding errors, skipping tests, or asserting implementation trivia.
- A solution is not complete until the relevant tests fail for the right reason before the fix or would have failed against the previous behavior.

## Anti-Gaming Rules

- Do not delete, skip, or loosen tests to make a change look successful.
- Do not mock the unit under test in a way that bypasses the behavior being verified.
- Do not assert only that a component rendered if the requirement is about navigation, security, validation, or data handling.
- Do not hard-code test-only branches in production code.
- Do not silence TypeScript, ESLint, or runtime errors without explaining and justifying the tradeoff.
- Do not claim security controls are implemented unless code, infrastructure, docs, and tests all support that claim.

## Required Verification

Run the narrowest relevant checks while developing, then run the full suite before handoff when feasible:

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

If a command cannot be run, report that explicitly with the reason.

## Security Rules

- Keep S3 buckets private and retain `enforceSSL`.
- Preserve the CV bucket policy that requires `AES256` encryption for `incoming/*` uploads.
- Preserve malware scan gating before CV download URLs are issued.
- Keep sensitive DynamoDB fields encrypted at application level unless a planned migration replaces the mechanism.
- Keep admin password verification hash-based and constant-time.
- Do not log PII, raw authorization headers, presigned URLs, encryption keys, password hashes, or raw submitted CV contents.
- When adding secrets, prefer documented environment/GitHub secrets for the free-tier path; document paid alternatives separately.

## Documentation Rules

- Update `README.md` and `docs/AWS_DEPLOYMENT.md` when changing deployment parameters, security posture, AWS services, test commands, or operational steps.
- Document free-tier choices separately from paid best-practice options.
- Include migration/rotation notes when changing encryption, auth, or storage formats.

## Frontend Rules

- Keep the app as a usable recruitment website, not a generic Vite template.
- Preserve accessible labels, headings, and button names used by tests.
- Prefer user-visible behavior tests over snapshots.
- Check mobile and desktop behavior when changing navigation, forms, or layout.

## Backend Rules

- Validate inputs at the Lambda boundary.
- Keep presigned URLs short-lived.
- Keep file type checks based on metadata and file signature validation.
- Treat legacy plaintext records carefully during encryption migrations.
- Do not broaden IAM permissions without a specific reason.
