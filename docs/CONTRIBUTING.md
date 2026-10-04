# Contributing to iCamp

## Branches
- `main`: production/release.
- `dev`: integration/staging.
- Build/feature branches may be created from `dev` when isolation is useful.

Direct development should not use `main` as a working branch.

## Build discipline
Every change must identify the build or requirement it belongs to. A build is not complete because code exists; applicable CI, security, documentation and operational gates must pass.

## Commit hygiene
- Keep commits scoped and descriptive.
- Never commit passwords, API keys, tokens, private keys or real payment credentials.
- Do not place production personal data in tests, fixtures or screenshots.
- Database changes must later be performed through versioned migrations.
- Do not silently rewrite financial, audit or safety history.

## Review expectations
Changes affecting authentication, authorization, payment, refunds, booking concurrency, visitor access, physical gate/access commands, voice/IVR/DTMF/SMS, safety enforcement, financial records or data retention require explicit security review in the PR.

## Omnichannel discipline
Every product build must document support for Web/PWA, IVR/DTMF and SMS/MMS. A feature may use staff-transfer or secure-link fallback when that is safer or the operation is inherently visual. Channel-specific code must call the same canonical domain services rather than duplicate business rules.

## Manual actions
Manual user steps are reserved for provider/account/legal/secret operations that cannot safely be automated. Never ask a user to paste a production secret into an issue, commit, PR or chat.
