# Build 001 — Repository Foundation & Engineering Guardrails

## Objective
Create the minimum secure, testable engineering foundation on which every later iCamp build will rely.

## Delivered
- dev/main branch model.
- Next.js/React/TypeScript application foundation.
- strict TypeScript.
- ESLint and Prettier checks.
- repository verification tests.
- baseline secure HTTP headers.
- environment template and secret-safe ignore rules.
- CI for formatting, linting, typecheck, tests, build and dependency audit.
- CodeQL workflow.
- secret scanning workflow.
- Dependabot configuration for npm and GitHub Actions.
- PR template with explicit high-risk domain review.
- contribution and release/promotion rules.
- architecture/master vision/security/build roadmap source of truth.
- extended requirements for maintainable facilities, seasonal/yearly winterization, permanent-unit ownership, events, visitors, recreational devices, waterfront access and safety enforcement.

## Security decisions
- No real credentials are required for Build 001.
- Repository remains private.
- Production and integration branches are distinct.
- Runtime framework is pinned to Next.js 16.3.8, the current patched Active LTS line selected for this build.
- Node is pinned to the Node 24 LTS line for CI/development consistency.
- Real environment files are ignored.
- High-risk application domains are explicitly identified in PR/release gates.

## Acceptance criteria
- CI workflow passes on dev.
- CodeQL and secret scan complete without a blocking finding.
- `npm run verify` succeeds in CI.
- No manual secret/account setup is required.
- Build documentation is committed.
- Only after dev gates are GREEN may Build 001 be promoted to main.

## Manual action
None expected.
