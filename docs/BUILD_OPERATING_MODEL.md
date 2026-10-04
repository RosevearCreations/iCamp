# iCamp Build Operating Model

## Purpose

This document defines how iCamp2027 is developed and promoted.

iCamp is a **live application** expected to evolve continuously. The roadmap is a controlled source of truth, not a prohibition on future changes. New campground requirements can be added, existing workflows can be extended, and providers can be replaced without abandoning the architecture.

## 1. Autonomous development by default

When a build is requested:
1. work on `dev`;
2. implement the build and any necessary tests/documentation;
3. resolve ordinary code, CI, schema and configuration issues autonomously;
4. verify all applicable gates;
5. promote to `main` only after `dev` is GREEN;
6. verify the production/release branch after promotion;
7. synchronize `dev` and `main` when appropriate;
8. advance the active build queue.

Do not interrupt the user for routine coding, formatting, CI fixes, documentation edits, migrations that can be safely automated, or connected-tool operations.

## 2. When user intervention is appropriate

Ask for manual action only when it cannot safely or technically be completed through connected tools, including examples such as:
- accepting external provider terms;
- entering billing/payment information;
- creating or entering production secrets in a provider secret store;
- MFA/identity verification;
- DNS/domain ownership changes;
- purchasing/activating a telephone number;
- regulatory registration required by a communications provider;
- connecting physical gate/access hardware;
- supplying real campground overhead/site images;
- entering real business, tax or legal details;
- approving regulated financing/provider agreements.

When manual action is necessary:
1. explain why it is required;
2. provide exact numbered steps;
3. identify the precise page/control when known;
4. state what **not** to paste into ChatGPT;
5. state exactly what non-secret confirmation/result to return.

## 3. Free-first development

Design and test with free/open-source software and free development tiers wherever practical.

A free tier is a development convenience, not an architectural dependency.

Every provider choice must preserve a realistic path to:
- a larger paid tier;
- a competing provider adapter;
- self-hosting;
- or another PostgreSQL/web/object-storage-compatible platform where practical.

## 4. Continuous flexibility

Prefer:
- feature flags;
- versioned configuration;
- additive/backward-compatible schema changes;
- modular domain services;
- provider adapters;
- explicit interfaces/contracts;
- migrations with recovery paths.

Avoid:
- hard-coded campground-specific assumptions;
- provider-specific business logic;
- one giant tightly coupled application;
- destructive history rewrites;
- changes that make future migration unnecessarily difficult.

## 5. Source-of-truth updates

When a new requirement materially changes scope or architecture, update the applicable:
- Master Vision;
- Architecture;
- Security Standard;
- Omnichannel source;
- Requirements Coverage Matrix;
- Build Roadmap;
- active build documentation.

Requirements should not exist only in chat history.

## 6. Build completion summary

After every completed build, provide a **verbose summary** containing at minimum:

### Build identity
- build number/name;
- final main commit/SHA;
- dev/main status;
- whether a deployment/provider action occurred.

### What was delivered
- user-visible capabilities;
- architecture/infrastructure changes;
- important files/modules;
- source-of-truth changes.

### Requirement coverage
- which roadmap/vision requirements were advanced;
- channel support: Web/PWA, IVR/DTMF, SMS/MMS and any safe fallback.

### Security and privacy
- authorization implications;
- data/sensitive information implications;
- new external interfaces;
- security checks performed;
- unresolved limitations, if any.

### Testing and verification
- formatting;
- lint;
- typecheck;
- automated tests;
- production build;
- dependency audit;
- secret scan;
- deployment/smoke checks where applicable.

### Cost and portability
- any new service/provider;
- whether it is free for development;
- migration/scale path.

### Manual action
- clearly state **None** when no action is required;
- otherwise provide detailed numbered instructions.

### Queue
- state whether the queue has run out;
- identify the exact next build.

## 7. Promotion rule

A build is never reported as fully GREEN merely because code was written.

Applicable dev gates must pass before promotion, and applicable main/production gates must pass after promotion.

If a provider/deployment has not yet been configured by design, state that explicitly rather than pretending a production deployment exists.
