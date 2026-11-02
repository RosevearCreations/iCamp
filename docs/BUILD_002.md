# Build 002 — Environment, Configuration, Health & I.T. Analysis Foundation

## Status
**FULLY PROMOTED — `main` verification GREEN.**

## Objective

Create a safe runtime/environment foundation and the first I.T./Analysis capabilities required to diagnose a continuously evolving campground platform.

Build 002 deliberately separates:
- public/client-safe service status;
- internal I.T. diagnostics;
- external lockup detection.

Detailed private diagnostics do not become publicly available merely because an I.T. workspace exists.

## Delivered architecture

### Typed runtime configuration
Runtime configuration now validates:
- application name;
- environment;
- application version;
- build SHA/reference;
- release ID;
- deployment timestamp;
- log level;
- feature flags.

Supported environments:
- development;
- test;
- staging;
- production.

Invalid typed values fail runtime configuration validation rather than silently producing an unknown state.

### Environment safety
Non-production UI receives an explicit environment banner telling operators to use synthetic/test information only.

The environment template contains no real secrets and documents the supported runtime identity and feature flags.

### Feature flags
Build 002 establishes feature flags for:
- I.T./Analysis workspace;
- public system-status page;
- external watchdog connection.

The flags are provider-neutral and server-controlled.

### Health contracts
Endpoints:
- `/api/health` — sanitized overall service state;
- `/api/health/live` — liveness for external monitoring;
- `/api/health/ready` — readiness/configuration validity;
- `/api/version` — safe release/version/build identity.

All health responses use `Cache-Control: no-store`.

### Correlation IDs
The Next.js proxy creates an iCamp request ID for application requests and propagates it through request/response headers.

iCamp generates the ID rather than trusting an arbitrary client-provided correlation value.

### Client-safe error surfaces
Application error boundaries provide plain-language errors and, when Next.js provides one, a safe digest/support reference.

Raw stack traces and exception payloads are not presented to ordinary clients.

### I.T. & Analysis workspace
A new I.T./Analysis workspace is registered in the main iCamp shell.

Because authentication/permissions are not implemented until Builds 004–006, Build 002 intentionally restricts the workspace to public-safe health information.

Future I.T. capabilities documented in the source of truth include:
- error grouping/fingerprints;
- request/correlation lookup;
- integration health;
- queue/scheduler health;
- performance/resource trends;
- release correlation;
- incidents/escalation;
- diagnostic exports.

### Public/global status
The `/status` page provides globally accessible client-safe system condition and release information without exposing logs, stack traces, secrets, client records or detailed infrastructure state.

### Lockup detection
A process that is completely frozen cannot reliably tell us that it is frozen.

Build 002 therefore establishes a provider-neutral external watchdog contract:
- check `/api/health/live`;
- optionally check `/api/health/ready`;
- initial recommended cadence: 60 seconds;
- initial failure threshold: 3 consecutive failures.

No paid watchdog provider is selected in this build.

### Diagnostic redaction
A reusable diagnostic redaction helper treats keys containing authentication, cookie, password, secret, token, API-key, PIN, card/CVV and session indicators as sensitive.

This is a baseline safety utility, not a substitute for later structured telemetry policy and authorization.

## Source-of-truth changes
Updated:
- Master Vision;
- Architecture;
- Security Standard;
- Build Roadmap;
- Requirements Coverage Matrix.

Added:
- `docs/IT_ANALYSIS.md`.

## Channel support

### Web/PWA
**Full for Build 002.**
- environment safety banner;
- public status page;
- I.T. workspace safe health view.

### IVR/DTMF
**Future guided equivalent.**
The health/status business contract exists now, but no telephone provider is connected until Builds 009–015.

### SMS/MMS
**Future guided/secure-link equivalent.**
Public status and support references can later be delivered through the communications subsystem.

### Visual-only limitation
Detailed charts/traces will be web interfaces. Telephone/SMS will provide summaries, alerts and secure-link/staff handoff rather than pretending to reproduce a diagnostic dashboard on a numeric keypad.

## Security/privacy
- no secrets introduced;
- no real client data required;
- no raw logs exposed publicly;
- no stack traces returned by health/status APIs;
- public health fields are allow-listed;
- detailed I.T. information remains deferred until authentication/authorization/audit controls exist;
- request bodies are not collected as telemetry;
- external monitor remains provider-neutral.

## Cost and portability
**No paid service required.**

All Build 002 health/diagnostic contracts are implemented in iCamp itself and can later be monitored by a free/self-hosted or paid monitoring product without changing campground business logic.

## Manual action
**None expected.**

No monitoring account, database, secret, domain, phone number or production hosting configuration is required for Build 002.


## Dev verification evidence

Verified on dev application commit `06714889bef93e08a7b3d4a15f006d34a8a86c33`.

Passed:
- canonical formatter check;
- ESLint with zero warnings;
- strict TypeScript typecheck;
- repository/application invariant tests;
- Next.js production build;
- production dependency audit at high/critical threshold;
- full dependency audit artifact capture;
- Gitleaks secret scan.

CodeQL remains configured but eligibility-skipped on this private repository because the current GitHub account does not have private-repository Code Security entitlement.

## Build 002 acceptance outcome

Delivered:
- typed runtime/environment configuration;
- development/test/staging/production environment model;
- non-production safety banner;
- server startup configuration validation;
- safe feature-flag foundation;
- iCamp-generated request/correlation IDs;
- public health/liveness/readiness/version API contracts;
- client-safe global status page;
- dedicated I.T. & Analysis workspace foundation;
- provider-neutral external watchdog contract;
- error/support-reference surfaces;
- baseline diagnostic redaction utility;
- I.T./Analysis requirements carried into later queue/scheduler, performance, security and production-readiness builds.

No detailed sensitive diagnostics are exposed before authentication, permissions and audit controls exist.


## Promotion and production/release verification

Application promotion commit: `1da61a7d86304f10f372c79415640ec3450bcd24`.

The promoted `main` commit passed:
- formatter;
- lint;
- strict TypeScript;
- automated/invariant tests;
- Next.js production build;
- production dependency audit;
- full dependency audit capture;
- Gitleaks secret scan.

No external hosting/monitoring provider is configured yet by design. `main` is the current production/release branch; later environment/deployment builds will attach the release to actual hosted infrastructure while preserving these health contracts.
