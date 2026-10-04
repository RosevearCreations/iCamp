# Build 002 — Environment, Configuration, Health & I.T. Analysis Foundation

## Status
**IN PROGRESS on `dev`.**

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
