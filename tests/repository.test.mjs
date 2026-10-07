import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("package remains private and requires the supported Node LTS line", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));

  assert.equal(pkg.private, true);
  assert.equal(pkg.engines.node, ">=24 <25");
});

test("real environment files are ignored while the template remains tracked", async () => {
  const gitignore = await readFile(".gitignore", "utf8");

  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});

test("source-of-truth documents remain present in README", async () => {
  const readme = await readFile("README.md", "utf8");

  for (const required of [
    "MASTER_VISION.md",
    "ARCHITECTURE.md",
    "BUILD_ROADMAP.md",
    "REQUIREMENTS_COVERAGE.md",
    "OMNICHANNEL.md",
    "SECURITY.md",
    "BUILD_QUEUE.md",
    "PRE_IMPLEMENTATION_BASELINE.md",
    "BUILD_OPERATING_MODEL.md",
    "IT_ANALYSIS.md",
    "HELP_SYSTEM.md",
    "ADMIN_FRESHNESS.md",
    "AUTHENTICATION.md",
    "AUTHORIZATION.md",
    "AUDIT_AND_PRIVILEGED_ACTIONS.md",
  ]) {
    assert.ok(readme.includes(required), `README must link ${required}`);
  }
});

test("active roadmap contains exactly Builds 001 through 156", async () => {
  const roadmap = await readFile("docs/BUILD_ROADMAP.md", "utf8");
  const matches = [...roadmap.matchAll(/^## Build (\d{3}) —/gm)].map((match) =>
    Number(match[1]),
  );

  assert.equal(matches.length, 156);
  assert.deepEqual(
    matches,
    Array.from({ length: 156 }, (_, index) => index + 1),
  );
});

test("roadmap reset keeps the active sequence and old foundation separated", async () => {
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");
  const baseline = await readFile(
    "docs/PRE_IMPLEMENTATION_BASELINE.md",
    "utf8",
  );

  assert.match(
    queue,
    /Build 001 — Responsive PWA & Omnichannel Application Shell/,
  );
  assert.match(queue, /The active roadmap contains \*\*156 builds\*\*/);
  assert.match(baseline, /intentionally \*\*unnumbered\*\*/);
});

test("omnichannel source requires IVR DTMF and SMS channel parity", async () => {
  const omnichannel = await readFile("docs/OMNICHANNEL.md", "utf8");

  assert.match(omnichannel, /IVR\/DTMF/);
  assert.match(omnichannel, /SMS\/MMS/);
  assert.match(omnichannel, /same iCamp backend/i);
  assert.match(omnichannel, /caller ID/i);
});

test("Build 001 exposes all required workspace shells", async () => {
  const workspaces = await readFile("lib/workspaces.ts", "utf8");

  for (const slug of [
    "public",
    "guest",
    "front-desk",
    "maintenance",
    "security",
    "store",
    "staff",
    "foreman",
    "management",
    "finance",
  ]) {
    assert.match(workspaces, new RegExp(`slug: ["']${slug}["']`));
  }
});

test("Build 001 defines Web IVR and SMS channel capability contracts", async () => {
  const channels = await readFile("lib/channels.ts", "utf8");

  assert.match(channels, /web:/);
  assert.match(channels, /ivr:/);
  assert.match(channels, /sms:/);
  assert.match(channels, /secure-link/);
  assert.match(channels, /staff-transfer/);
});

test("Build 001 includes PWA and portable deployment baselines", async () => {
  const manifest = await readFile("app/manifest.ts", "utf8");
  const nextConfig = await readFile("next.config.ts", "utf8");
  const serviceWorker = await readFile("public/sw.js", "utf8");

  assert.match(manifest, /display: ["']standalone["']/);
  assert.match(manifest, /start_url: ["']\/["']/);
  assert.match(nextConfig, /output: ["']standalone["']/);
  assert.match(serviceWorker, /addEventListener\(["']fetch["']/);
});

test("Build 001 architecture codifies free-first evolution and migration", async () => {
  const architecture = await readFile("docs/ARCHITECTURE.md", "utf8");

  assert.match(architecture, /Free-First Development/);
  assert.match(architecture, /Scale-up migration/i);
  assert.match(architecture, /feature flags/i);
  assert.match(architecture, /provider adapters/i);
});

test("Build 001 responsive shell includes tablet and phone breakpoints", async () => {
  const css = await readFile("app/globals.css", "utf8");

  assert.match(css, /@media \(max-width: 60rem\)/);
  assert.match(css, /@media \(max-width: 46rem\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /skip-link/);
});

test("build operating model preserves autonomous free-first delivery", async () => {
  const operatingModel = await readFile(
    "docs/BUILD_OPERATING_MODEL.md",
    "utf8",
  );

  assert.match(operatingModel, /Autonomous development by default/);
  assert.match(operatingModel, /Free-first development/);
  assert.match(operatingModel, /verbose summary/i);
  assert.match(operatingModel, /exact numbered steps/i);
});

test("Build 002 defines typed environment and health contracts", async () => {
  const runtime = await readFile("lib/config/runtime.ts", "utf8");
  const envTemplate = await readFile(".env.example", "utf8");

  for (const environment of ["development", "test", "staging", "production"]) {
    assert.match(runtime, new RegExp(`["']${environment}["']`));
  }

  assert.match(
    runtime,
    /NEXT_PUBLIC_APP_ENV and ICAMP_APP_ENV|ICAMP_APP_ENV and NEXT_PUBLIC_APP_ENV/,
  );
  assert.match(envTemplate, /ICAMP_BUILD_SHA/);
  assert.match(envTemplate, /ICAMP_FEATURE_EXTERNAL_WATCHDOG/);
});

test("Build 002 exposes sanitized health readiness liveness and version routes", async () => {
  for (const path of [
    "app/api/health/route.ts",
    "app/api/health/live/route.ts",
    "app/api/health/ready/route.ts",
    "app/api/version/route.ts",
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /Cache-Control/);
    assert.match(source, /no-store/);
  }
});

test("Build 002 preserves correlation redaction and lockup watchdog contracts", async () => {
  const proxy = await readFile("proxy.ts", "utf8");
  const redaction = await readFile("lib/observability/redaction.ts", "utf8");
  const watchdog = await readFile("lib/observability/watchdog.ts", "utf8");

  assert.match(proxy, /x-icamp-request-id/);
  assert.match(proxy, /createRequestId/);
  assert.match(redaction, /REDACTED/);
  assert.match(redaction, /password/);
  assert.match(redaction, /token/);
  assert.match(redaction, /pin/i);
  assert.match(watchdog, /\/api\/health\/live/);
  assert.match(watchdog, /recommendedCheckSeconds: 60/);
  assert.match(watchdog, /recommendedFailureThreshold: 3/);
});

test("Build 002 includes IT analysis and client-safe status surfaces", async () => {
  const workspaces = await readFile("lib/workspaces.ts", "utf8");
  const itPage = await readFile("app/workspaces/it-analysis/page.tsx", "utf8");
  const statusPage = await readFile("app/status/page.tsx", "utf8");
  const banner = await readFile("components/environment-banner.tsx", "utf8");

  assert.match(workspaces, /slug: ["']it-analysis["']/);
  assert.match(itPage, /Sensitive diagnostics stay protected/);
  assert.match(statusPage, /public-safe|safe service information/i);
  assert.match(banner, /Non-production environment/);
});

test("Build 002 source of truth requires external lockup detection and diagnostic privacy", async () => {
  const itSource = await readFile("docs/IT_ANALYSIS.md", "utf8");
  const security = await readFile("docs/SECURITY.md", "utf8");

  assert.match(itSource, /external watchdog/i);
  assert.match(itSource, /frozen runtime/i);
  assert.match(security, /stack traces/i);
  assert.match(security, /I\.T\. Diagnostics and Observability Security/);
});

test("Build 003 defines provider-portable multi-property migrations", async () => {
  const migration = await readFile(
    "database/migrations/0001_core_multi_property_and_refresh.sql",
    "utf8",
  );
  const runner = await readFile(
    "scripts/apply-database-migrations.mjs",
    "utf8",
  );

  for (const table of [
    "organizations",
    "campgrounds",
    "campground_sections",
    "campground_subsections",
    "admin_refresh_states",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }

  assert.match(runner, /schema_migrations/);
  assert.match(runner, /sha256/);
  assert.match(runner, /different checksum/);
});

test("Build 003 CI verifies migrations against PostgreSQL", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");

  assert.match(workflow, /postgres:17-alpine/);
  assert.match(workflow, /Database migrations/);
  assert.match(workflow, /apply-database-migrations\.mjs/);
  assert.match(workflow, /Verify all database contracts/);
});

test("Build 003 provides visible admin freshness controls", async () => {
  const component = await readFile(
    "components/admin-refresh-control.tsx",
    "utf8",
  );
  const migration = await readFile(
    "database/migrations/0001_core_multi_property_and_refresh.sql",
    "utf8",
  );

  assert.match(component, /Refresh data/);
  assert.match(component, /Data freshness/);
  assert.match(component, /router\.refresh/);
  assert.match(migration, /refresh_status/);
  assert.match(migration, /source_watermark/);
  assert.match(migration, /last_succeeded_at/);
  assert.match(migration, /last_failed_at/);
});

test("Build 003 contextual help uses a circular information control and full help pages", async () => {
  const helpInfo = await readFile("components/help-info.tsx", "utf8");
  const sectionHeading = await readFile(
    "components/section-heading.tsx",
    "utf8",
  );
  const topics = await readFile("lib/help/topics.ts", "utf8");
  const css = await readFile("app/globals.css", "utf8");

  assert.match(helpInfo, /<summary/);
  assert.match(helpInfo, /aria-label/);
  assert.match(helpInfo, /Open full help/);
  assert.match(sectionHeading, /helpTopic/);
  assert.match(topics, /"customer\.input"/);
  assert.match(topics, /"admin\.refresh"/);
  assert.match(css, /border-radius: 999px/);
  assert.match(css, /\.help-info/);
});

test("Build 003 source of truth requires help on new sections and freshness on admin data", async () => {
  const roadmap = await readFile("docs/BUILD_ROADMAP.md", "utf8");
  const help = await readFile("docs/HELP_SYSTEM.md", "utf8");
  const freshness = await readFile("docs/ADMIN_FRESHNESS.md", "utf8");

  assert.match(
    roadmap,
    /every new user-facing\/admin section register contextual help/i,
  );
  assert.match(roadmap, /freshness\/last-refresh state/i);
  assert.match(help, /circular \*\*ⓘ\*\*/);
  assert.match(freshness, /last successful refresh/i);
  assert.match(freshness, /source watermark/i);
});

test("Build 004 keeps authentication secrets in the private schema", async () => {
  const migration = await readFile(
    "database/migrations/0002_authentication_and_sessions.sql",
    "utf8",
  );

  for (const table of [
    "user_accounts",
    "password_credentials",
    "auth_sessions",
    "password_recovery_tokens",
    "mfa_factors",
  ]) {
    assert.match(
      migration,
      new RegExp(`create table icamp_private\\.${table}`),
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`create table public\\.${table}`),
    );
  }

  assert.match(migration, /token_hash bytea/);
  assert.doesNotMatch(migration, /\bsession_token\b/);
  assert.doesNotMatch(migration, /\brecovery_token\b/);
});

test("Build 004 session cookies are server-only and production hardened", async () => {
  const cookies = await readFile("lib/auth/session-cookie.ts", "utf8");

  assert.match(cookies, /__Host-icamp_session/);
  assert.match(cookies, /httpOnly: true/);
  assert.match(cookies, /sameSite: "lax"/);
  assert.match(cookies, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(cookies, /maxAge: SESSION_MAX_AGE_SECONDS/);
});

test("Build 004 protects authentication mutations and return paths", async () => {
  const security = await readFile("lib/auth/request-security.ts", "utf8");

  assert.match(security, /isSameOriginMutation/);
  assert.match(security, /origin/);
  assert.match(security, /safeReturnPath/);
  assert.match(security, /startsWith\("\/\/"\)/);
});

test("Build 004 public auth flows avoid account enumeration", async () => {
  const login = await readFile("lib/auth/postgres.mjs", "utf8");
  const register = await readFile("app/api/auth/register/route.ts", "utf8");
  const recovery = await readFile(
    "app/api/auth/recovery/request/route.ts",
    "utf8",
  );

  assert.match(login, /DUMMY_PASSWORD_HASH/);
  assert.match(login, /locked_until/);
  assert.match(register, /23505/);
  assert.match(register, /status=registration/);
  assert.match(recovery, /status=requested/);
});

test("Build 004 keeps guest workspace behind authenticated identity", async () => {
  const workspace = await readFile(
    "app/workspaces/[workspace]/page.tsx",
    "utf8",
  );

  assert.match(workspace, /requireSignedIn/);
  assert.match(workspace, /workspace\.slug === "guest"/);
});

test("Build 004 CI verifies the full authentication lifecycle", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const lifecycle = await readFile("scripts/verify-auth-lifecycle.mjs", "utf8");

  assert.match(workflow, /Verify authentication lifecycle/);
  assert.match(workflow, /npm run auth:verify/);
  assert.match(lifecycle, /createGuestAccount/);
  assert.match(lifecycle, /createStaffAccountForBootstrap/);
  assert.match(lifecycle, /resetPasswordWithToken/);
  assert.match(lifecycle, /revokedSession/);
});

test("Build 004 auth forms include contextual help topics", async () => {
  const topics = await readFile("lib/help/topics.ts", "utf8");

  for (const topic of [
    "auth.login",
    "auth.register",
    "auth.recovery",
    "auth.sessions",
  ]) {
    assert.match(topics, new RegExp(`"${topic}"`));
  }
});

test("Build 004 source of truth records portable Supabase development hosting", async () => {
  const auth = await readFile("docs/AUTHENTICATION.md", "utf8");

  assert.match(auth, /rosevearcreations/);
  assert.match(auth, /cxgszmpbeswdikzofvjv/);
  assert.match(auth, /vanilla PostgreSQL 17/i);
  assert.match(auth, /source of truth for schema design/i);
});

test("Build 004 auth session trigger has its required timestamp", async () => {
  const migration = await readFile(
    "database/migrations/0003_auth_session_updated_at.sql",
    "utf8",
  );
  const verification = await readFile(
    "database/verify/0003_auth_session_updated_at.sql",
    "utf8",
  );

  assert.match(migration, /alter table icamp_private\.auth_sessions/);
  assert.match(migration, /updated_at timestamptz/);
  assert.match(verification, /auth_sessions\.updated_at is required/);
});

test("Build 004 recovery verification proves token supersession", async () => {
  const lifecycle = await readFile("scripts/verify-auth-lifecycle.mjs", "utf8");

  assert.match(lifecycle, /firstRecovery/);
  assert.match(lifecycle, /superseded/);
  assert.match(lifecycle, /assert\.equal\(superseded, false\)/);
});

test("Build 005 defines the permission and campground assignment model", async () => {
  const migration = await readFile(
    "database/migrations/0004_roles_permissions_rls.sql",
    "utf8",
  );

  for (const table of [
    "permission_catalog",
    "roles",
    "role_permissions",
    "campground_assignments",
    "campground_assignment_roles",
  ]) {
    assert.match(
      migration,
      new RegExp(`create table icamp_private\\.${table}`),
    );
  }

  assert.match(migration, /create role icamp_app nologin noinherit/);
  assert.match(migration, /validate_staff_assignment/);
  assert.match(migration, /validate_assignment_role_scope/);
  assert.match(migration, /Custom roles cannot cross organization boundaries/);
});

test("Build 005 forces RLS and revokes public access on scoped tables", async () => {
  const migration = await readFile(
    "database/migrations/0004_roles_permissions_rls.sql",
    "utf8",
  );

  for (const table of [
    "organizations",
    "campgrounds",
    "campground_sections",
    "campground_subsections",
    "admin_refresh_states",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke all on public\\.${table} from public`),
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} force row level security`),
    );
  }

  assert.match(migration, /request_user_id/);
  assert.match(migration, /invalid_text_representation/);
  assert.match(migration, /has_campground_permission/);
  assert.match(migration, /has_organization_permission/);
});

test("Build 005 replaces coarse staff gates with workspace permissions", async () => {
  const workspace = await readFile(
    "app/workspaces/[workspace]/page.tsx",
    "utf8",
  );
  const itWorkspace = await readFile(
    "app/workspaces/it-analysis/page.tsx",
    "utf8",
  );
  const registry = await readFile("lib/workspaces.ts", "utf8");

  assert.match(workspace, /requireAnyCampgroundPermission/);
  assert.match(workspace, /workspace\.requiredPermission/);
  assert.match(itWorkspace, /requireAnyCampgroundPermission/);
  assert.match(itWorkspace, /"it\.health\.read"/);
  assert.match(registry, /requiredPermission: "reservation\.read"/);
  assert.match(registry, /requiredPermission: "finance\.read"/);
});

test("Build 005 CI verifies authorization and cross-property isolation", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const lifecycle = await readFile(
    "scripts/verify-authorization-lifecycle.mjs",
    "utf8",
  );
  const verification = await readFile(
    "database/verify/0004_roles_permissions_rls.sql",
    "utf8",
  );

  assert.match(workflow, /Verify authorization lifecycle/);
  assert.match(workflow, /npm run authz:verify/);
  assert.match(lifecycle, /createCustomRole/);
  assert.match(lifecycle, /assignStaffToCampground/);
  assert.match(lifecycle, /listVisibleCampgroundsViaRls/);
  assert.match(lifecycle, /campB\.campgroundId/);
  assert.match(verification, /cross_org_role_rejected_ok/);
  assert.match(verification, /cross_property_update_denied_ok/);
  assert.match(verification, /unassigned_sees_nothing_ok/);
});

test("Build 005 permission catalogue covers privileged operational domains", async () => {
  const permissions = await readFile("lib/authz/permissions.ts", "utf8");

  for (const permission of [
    "role.manage",
    "refund.issue",
    "gate.override.open",
    "winterization.signoff",
    "financing.manage",
    "it.diagnostics.export",
    "system.admin",
  ]) {
    assert.match(
      permissions,
      new RegExp(`"${permission.replace(".", "\\.")}"`),
    );
  }
});

test("Build 006 defines append-only audit evidence and reauthentication state", async () => {
  const migration = await readFile(
    "database/migrations/0007_audit_privileged_actions.sql",
    "utf8",
  );

  assert.match(migration, /create table icamp_private\.audit_events/);
  assert.match(migration, /reauthenticated_at timestamptz/);
  assert.match(migration, /audit_events_privileged_reason_check/);
  assert.match(migration, /prevent_audit_event_mutation/);
  assert.match(
    migration,
    /before update or delete on icamp_private\.audit_events/,
  );
  assert.match(
    migration,
    /revoke all on icamp_private\.audit_events from public/,
  );
});

test("Build 006 enforces privileged reason and recent reauthentication", async () => {
  const privileged = await readFile("lib/audit/privileged.mjs", "utf8");
  const auth = await readFile("lib/auth/postgres.mjs", "utf8");

  assert.match(privileged, /PRIVILEGED_REASON_MIN_LENGTH = 8/);
  assert.match(privileged, /RECENT_REAUTHENTICATION_SECONDS = 10 \* 60/);
  assert.match(privileged, /assertRecentReauthentication/);
  assert.match(privileged, /hasRequiredAssurance/);
  assert.match(auth, /reauthenticateSession/);
  assert.match(auth, /reauthenticated_at = statement_timestamp\(\)/);
});

test("Build 006 audits existing high-risk role mutations transactionally", async () => {
  const authorization = await readFile("lib/authz/postgres.mjs", "utf8");
  const auditWriter = await readFile("lib/audit/postgres.mjs", "utf8");

  assert.match(authorization, /assertPrivilegedActionControl/);
  assert.match(authorization, /authorization\.role\.create/);
  assert.match(authorization, /authorization\.staff_assignment\.upsert/);
  assert.match(authorization, /permissionKey: "role\.manage"/);
  assert.match(authorization, /beforeState/);
  assert.match(authorization, /afterState/);
  assert.match(auditWriter, /insert into icamp_private\.audit_events/);
});

test("Build 006 CI verifies audit and privileged-action lifecycle", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const lifecycle = await readFile(
    "scripts/verify-audit-lifecycle.mjs",
    "utf8",
  );

  assert.match(workflow, /Verify audit and privileged-action lifecycle/);
  assert.match(workflow, /npm run audit:verify/);
  assert.match(lifecycle, /Recent re-authentication is required/);
  assert.match(lifecycle, /authorization\.role\.create/);
  assert.match(lifecycle, /authorization\.staff_assignment\.upsert/);
  assert.match(lifecycle, /Audit events are append-only/);
});

test("Build 006 source of truth preserves channel-neutral privileged controls", async () => {
  const source = await readFile("docs/AUDIT_AND_PRIVILEGED_ACTIONS.md", "utf8");
  const build = await readFile("docs/BUILD_006.md", "utf8");

  assert.match(source, /Append-only audit evidence/);
  assert.match(source, /Web\/PWA, IVR\/DTMF and SMS/);
  assert.match(source, /same database transaction/);
  assert.match(
    build,
    /Build 007 — Background Jobs, Scheduler & Operational Queues/,
  );
});

test("Build 007 defines private durable schedules queues and operational heartbeats", async () => {
  const migration = await readFile(
    "database/migrations/0008_background_jobs_scheduler_queues.sql",
    "utf8",
  );

  for (const table of [
    "job_schedules",
    "job_queue",
    "queue_workers",
    "scheduler_heartbeats",
  ]) {
    assert.match(
      migration,
      new RegExp("create table icamp_private\\." + table),
    );
  }

  const fkIndexes = await readFile(
    "database/migrations/0009_background_jobs_fk_indexes.sql",
    "utf8",
  );

  assert.match(migration, /job_queue_idempotency_idx/);
  assert.match(migration, /job_queue_claim_idx/);
  assert.match(fkIndexes, /job_schedules_scope_idx/);
  assert.match(fkIndexes, /job_queue_scope_idx/);
  assert.match(
    migration,
    /state in \('queued', 'running', 'succeeded', 'dead_letter'\)/,
  );
  assert.match(migration, /revoke all on icamp_private\.job_queue from public/);
});

test("Build 007 queue runtime enforces idempotency leases retries and dead-letter recovery", async () => {
  const jobs = await readFile("lib/jobs/postgres.mjs", "utf8");

  assert.match(jobs, /on conflict \(queue_name, idempotency_key\)/);
  assert.match(jobs, /for update skip locked/);
  assert.match(jobs, /lease_expires_at > statement_timestamp\(\)/);
  assert.match(jobs, /recoverExpiredLeases/);
  assert.match(jobs, /retryDelaySeconds/);
  assert.match(jobs, /dead_letter/);
  assert.match(jobs, /runDueSchedules/);
});

test("Build 007 CI proves the queue lifecycle and I.T. shows safe aggregate health", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const lifecycle = await readFile(
    "scripts/verify-background-jobs-lifecycle.mjs",
    "utf8",
  );
  const itPage = await readFile("app/workspaces/it-analysis/page.tsx", "utf8");

  assert.match(workflow, /Verify background jobs and scheduler lifecycle/);
  assert.match(workflow, /npm run jobs:verify/);
  assert.match(lifecycle, /duplicateEnqueue/);
  assert.match(lifecycle, /Synthetic final-attempt verification/);
  assert.match(lifecycle, /leaseExpiryFixture/);
  assert.match(itPage, /getOperationalQueueHealth/);
  assert.match(itPage, /Payloads remain private/);
});

test("Build 007 source of truth keeps execution provider-portable and channel-neutral", async () => {
  const source = await readFile("docs/BACKGROUND_JOBS.md", "utf8");
  const build = await readFile("docs/BUILD_007.md", "utf8");

  assert.match(source, /provider-portable PostgreSQL/i);
  assert.match(source, /at-least-once processing/i);
  assert.match(source, /Web\/PWA, IVR\/DTMF and SMS/);
  assert.match(source, /job payloads/i);
  assert.match(build, /Build 008 — Secure Media & Document Storage Foundation/);
});

test("Build 008 defines classified private media metadata and append-only lifecycle evidence", async () => {
  const migration = await readFile(
    "database/migrations/0010_secure_media_document_storage.sql",
    "utf8",
  );

  assert.match(migration, /create table icamp_private\.media_assets/);
  assert.match(migration, /create table icamp_private\.media_lifecycle_events/);
  assert.match(
    migration,
    /classification in \('public', 'internal', 'confidential'\)/,
  );
  assert.match(migration, /media_assets_lifecycle_guard/);
  assert.match(migration, /media_lifecycle_events_append_only/);
  assert.match(
    migration,
    /revoke all on icamp_private\.media_assets from public/,
  );
});

test("Build 008 validates file identity size and safe opaque object paths", async () => {
  const validation = await readFile("lib/media/validation.mjs", "utf8");

  assert.match(validation, /IMAGE_MAX_BYTES = 12 \* 1024 \* 1024/);
  assert.match(validation, /DOCUMENT_MAX_BYTES = 25 \* 1024 \* 1024/);
  assert.match(validation, /signature_mismatch/);
  assert.match(
    validation,
    /Only JPEG, PNG, WebP, GIF, and PDF files are accepted/,
  );
  assert.match(validation, /buildMediaObjectKey/);
  assert.match(validation, /mediaBucketForClassification/);
});

test("Build 008 private access remains behind iCamp campground authorization", async () => {
  const route = await readFile(
    "app/api/media/[mediaId]/access/route.ts",
    "utf8",
  );
  const storage = await readFile("lib/media/storage.mjs", "utf8");

  assert.match(route, /media\.confidential\.read/);
  assert.match(route, /media\.read/);
  assert.match(route, /hasCampgroundPermission/);
  assert.match(route, /createSignedReadUrl/);
  assert.match(storage, /between 60 and 900 seconds/);
  assert.match(storage, /ICAMP_SUPABASE_SECRET_KEY/);
});

test("Build 008 versions Supabase bucket restrictions without browser write policies", async () => {
  const provider = await readFile(
    "providers/supabase/storage/0001_media_buckets.sql",
    "utf8",
  );

  assert.match(provider, /icamp-public-media/);
  assert.match(provider, /icamp-internal-media/);
  assert.match(provider, /icamp-confidential-media/);
  assert.match(provider, /26214400/);
  assert.match(provider, /application\/pdf/);
  assert.doesNotMatch(provider, /create policy/i);
});

test("Build 008 CI proves media lifecycle and source of truth advances to communications", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const lifecycle = await readFile(
    "scripts/verify-media-lifecycle.mjs",
    "utf8",
  );
  const source = await readFile("docs/MEDIA_STORAGE.md", "utf8");
  const build = await readFile("docs/BUILD_008.md", "utf8");

  assert.match(workflow, /Verify secure media and document lifecycle/);
  assert.match(workflow, /npm run media:verify/);
  assert.match(lifecycle, /Not authorized to manage media/);
  assert.match(lifecycle, /append-only/);
  assert.match(source, /Web\/PWA/);
  assert.match(source, /IVR\/DTMF/);
  assert.match(source, /SMS\/MMS/);
  assert.match(source, /provider-neutral/i);
  assert.match(build, /Build 009 — Omnichannel Communications Foundation/);
});

test("Build 009 defines one private communications domain across all required channels", async () => {
  const migration = await readFile(
    "database/migrations/0011_omnichannel_communications_foundation.sql",
    "utf8",
  );

  for (const table of [
    "communication_endpoints",
    "communication_preferences",
    "communication_consents",
    "communication_dispatches",
    "communication_attempts",
    "communication_provider_events",
  ]) {
    assert.match(
      migration,
      new RegExp("create table icamp_private\\." + table),
    );
  }

  for (const channel of [
    "web",
    "voice",
    "dtmf",
    "speech",
    "sms",
    "mms",
    "email",
    "push",
  ]) {
    assert.match(migration, new RegExp("'" + channel + "'"));
  }

  assert.match(
    migration,
    /purpose in \('transactional', 'operational', 'marketing'\)/,
  );
});

test("Build 009 isolates endpoints and keeps consent/provider evidence append-only", async () => {
  const migration = await readFile(
    "database/migrations/0011_omnichannel_communications_foundation.sql",
    "utf8",
  );

  assert.match(migration, /communication_dispatches_endpoint_scope_fk/);

  const fkIndexes = await readFile(
    "database/migrations/0012_communications_fk_indexes.sql",
    "utf8",
  );
  assert.match(fkIndexes, /communication_preferences_updated_by_idx/);
  assert.match(migration, /communication_consents_append_only/);
  assert.match(migration, /communication_provider_events_append_only/);
  assert.match(
    migration,
    /communication_provider_events_provider_event_unique/,
  );
  assert.match(migration, /communication_dispatches_scope_idempotency_unique/);
  assert.match(
    migration,
    /revoke all on icamp_private\.communication_endpoints from public/,
  );
});

test("Build 009 implements replaceable provider retry and privacy boundaries", async () => {
  const provider = await readFile("lib/communications/provider.mjs", "utf8");
  const runtime = await readFile("lib/communications/postgres.mjs", "utf8");
  const source = await readFile("docs/COMMUNICATIONS.md", "utf8");

  assert.match(provider, /createMockCommunicationsProvider/);
  assert.match(provider, /ICAMP_COMMUNICATIONS_PROVIDER/);
  assert.match(runtime, /communicationRetryDelaySeconds/);
  assert.match(runtime, /MAX_RETRY_DELAY_SECONDS = 3600/);
  assert.match(runtime, /communications\.manage/);
  assert.match(runtime, /communications\.send/);
  assert.match(runtime, /rawEndpointExcluded/);
  assert.match(source, /raw webhook request bodies/i);
  assert.match(source, /caller ID\/phone ownership is not authentication/i);
});

test("Build 009 CI proves communications lifecycle and I.T. exposes aggregates only", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const lifecycle = await readFile(
    "scripts/verify-communications-lifecycle.mjs",
    "utf8",
  );
  const itPage = await readFile("app/workspaces/it-analysis/page.tsx", "utf8");
  const build = await readFile("docs/BUILD_009.md", "utf8");

  assert.match(workflow, /Verify omnichannel communications lifecycle/);
  assert.match(workflow, /npm run communications:verify/);
  assert.match(lifecycle, /Not authorized for communication operation/);
  assert.match(lifecycle, /communication_dispatches_endpoint_scope_fk/);
  assert.match(lifecycle, /duplicateEvent\.inserted, false/);
  assert.match(lifecycle, /append-only/);
  assert.match(itPage, /getCommunicationsHealth/);
  assert.match(
    itPage,
    /Endpoints, bodies and provider payloads remain private/,
  );
  assert.match(build, /Build 010 — Inbound\/Outbound Voice & IVR Gateway/);
});

test("Build 010 defines campground-scoped voice lines, calls and IVR evidence", async () => {
  const migration = await readFile(
    "database/migrations/0013_voice_ivr_gateway.sql",
    "utf8",
  );

  for (const table of [
    "voice_lines",
    "voice_calls",
    "voice_ivr_sessions",
    "voice_ivr_events",
  ]) {
    assert.match(
      migration,
      new RegExp("create table icamp_private\\." + table),
    );
  }

  assert.match(migration, /voice_calls_line_scope_fk/);
  assert.match(migration, /voice_calls_dispatch_scope_fk/);
  assert.match(migration, /voice_lines_staff_transfer_scope_fk/);

  const fkIndexes = await readFile(
    "database/migrations/0014_voice_fk_indexes.sql",
    "utf8",
  );
  assert.match(fkIndexes, /voice_calls_dispatch_scope_idx/);
  assert.match(fkIndexes, /voice_calls_line_scope_idx/);
  assert.match(migration, /voice_ivr_events_append_only/);
  assert.match(
    migration,
    /revoke all on icamp_private\.voice_calls from public/,
  );
});

test("Build 010 verifies signed webhooks with bounded freshness and no raw persistence", async () => {
  const provider = await readFile("lib/voice/provider.mjs", "utf8");
  const webhook = await readFile(
    "app/api/communications/voice/webhook/route.ts",
    "utf8",
  );
  const source = await readFile("docs/VOICE_IVR.md", "utf8");

  assert.match(provider, /createHmac\("sha256"/);
  assert.match(provider, /timingSafeEqual/);
  assert.match(provider, /between 30 and 900 seconds/);
  assert.match(webhook, /x-icamp-voice-timestamp/);
  assert.match(webhook, /x-icamp-voice-signature/);
  assert.match(webhook, /verifyVoiceWebhookSignature/);
  assert.match(source, /raw webhook bodies or signatures/i);
});

test("Build 010 provides provider-neutral outbound, IVR and staff transfer runtime", async () => {
  const runtime = await readFile("lib/voice/postgres.mjs", "utf8");
  const ivr = await readFile("lib/voice/ivr.mjs", "utf8");
  const outbound = await readFile(
    "app/api/communications/voice/outbound/route.ts",
    "utf8",
  );

  assert.match(runtime, /startOutboundVoiceCall/);
  assert.match(runtime, /ingestVoiceProviderEvent/);
  assert.match(runtime, /transferVoiceCallToStaff/);
  assert.match(runtime, /getVoiceGatewayHealth/);
  assert.match(runtime, /communications\.send/);
  assert.match(runtime, /communications\.manage/);
  assert.match(ivr, /staff_transfer/);
  assert.match(ivr, /DEFAULT_IVR_MAX_RETRIES = 3/);
  assert.match(outbound, /Authentication required/);
});

test("Build 010 CI proves voice lifecycle and advances toward DTMF", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const lifecycle = await readFile(
    "scripts/verify-voice-lifecycle.mjs",
    "utf8",
  );
  const itPage = await readFile("app/workspaces/it-analysis/page.tsx", "utf8");
  const build = await readFile("docs/BUILD_010.md", "utf8");

  assert.match(workflow, /Verify inbound\/outbound voice and IVR lifecycle/);
  assert.match(workflow, /npm run voice:verify/);
  assert.match(lifecycle, /Not authorized for voice gateway operation/);
  assert.match(lifecycle, /duplicateInbound\.duplicate, true/);
  assert.match(lifecycle, /transfer\.transfer\.transferred, true/);
  assert.match(lifecycle, /append-only/);
  assert.match(itPage, /getVoiceGatewayHealth/);
  assert.match(itPage, /Phone numbers, audio and transcripts remain private/);
  assert.match(build, /Build 011 — Numeric Keypad\/DTMF Interaction Engine/);
});


test("Build 011 implements short numeric keypad menus and bounded DTMF entry", async () => {
  const dtmf = await readFile("lib/voice/dtmf.mjs", "utf8");

  assert.match(dtmf, /"1": \{/);
  assert.match(dtmf, /"2": \{/);
  assert.match(dtmf, /"3": \{/);
  assert.match(dtmf, /"8": \{/);
  assert.match(dtmf, /"9": \{/);
  assert.match(dtmf, /"0": \{/);
  assert.match(dtmf, /raw === "\*"/);
  assert.match(dtmf, /DTMF_ENTRY_MAX_DIGITS = 12/);
  assert.match(dtmf, /lookup\.site/);
  assert.match(dtmf, /lookup\.reservation/);
  assert.match(dtmf, /lookup\.pass/);
  assert.match(dtmf, /nextRetry >= maxRetries/);
});

test("Build 011 keeps raw keypad digits out of durable provider and IVR evidence", async () => {
  const runtime = await readFile("lib/voice/postgres.mjs", "utf8");
  const provider = await readFile("lib/voice/provider.mjs", "utf8");
  const source = await readFile("docs/DTMF.md", "utf8");

  assert.match(runtime, /rawDigitsExcluded: true/);
  assert.match(runtime, /digitCount: summary\.digitCount/);
  assert.match(runtime, /sensitive: summary\.sensitive/);
  assert.doesNotMatch(
    runtime,
    /metadata:[\s\S]{0,300}digits: event\.dtmf\.digits/,
  );
  assert.match(provider, /eventType\.startsWith\("dtmf\."\)/);
  assert.match(provider, /eventStatus: eventType\.startsWith\("dtmf\."\)/);
  assert.match(source, /Raw sensitive digits/i);
  assert.match(source, /never written to provider-event metadata/i);
});

test("Build 011 signed webhook routes DTMF idempotently and never echoes entered identifiers", async () => {
  const webhook = await readFile(
    "app/api/communications/voice/webhook/route.ts",
    "utf8",
  );
  const runtime = await readFile("lib/voice/postgres.mjs", "utf8");

  assert.match(webhook, /verifyVoiceWebhookSignature/);
  assert.match(webhook, /ingestVoiceProviderEvent\(event, provider\)/);
  assert.match(webhook, /result\.dtmf\?\.action/);
  assert.doesNotMatch(webhook, /transientEntry/);
  assert.match(runtime, /on conflict \(provider_key, provider_event_id\) do nothing/);
  assert.match(runtime, /transition\.sensitive \? null : transition\.transientEntry/);
});

test("Build 011 CI proves DTMF flows, privacy and safe aggregate health", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const lifecycle = await readFile(
    "scripts/verify-dtmf-lifecycle.mjs",
    "utf8",
  );
  const itPage = await readFile("app/workspaces/it-analysis/page.tsx", "utf8");
  const build = await readFile("docs/BUILD_011.md", "utf8");

  assert.match(workflow, /Verify numeric keypad and DTMF lifecycle/);
  assert.match(workflow, /npm run dtmf:verify/);
  assert.match(lifecycle, /siteDuplicate\.duplicate, true/);
  assert.match(lifecycle, /7654321/);
  assert.match(lifecycle, /assert\.doesNotMatch\(providerText/);
  assert.match(lifecycle, /assert\.doesNotMatch\(ivrText/);
  assert.match(lifecycle, /timeoutTwo\.transfer\.transferred, true/);
  assert.match(itPage, /voiceHealth\.dtmf\.inputs24h/);
  assert.match(itPage, /digits never shown/);
  assert.match(
    build,
    /Build 012 — SMS\/MMS Conversation & Command Gateway/,
  );
});
