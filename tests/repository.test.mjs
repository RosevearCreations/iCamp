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
  assert.match(migration, /before update or delete on icamp_private\.audit_events/);
  assert.match(migration, /revoke all on icamp_private\.audit_events from public/);
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
  const source = await readFile(
    "docs/AUDIT_AND_PRIVILEGED_ACTIONS.md",
    "utf8",
  );
  const build = await readFile("docs/BUILD_006.md", "utf8");

  assert.match(source, /Append-only audit evidence/);
  assert.match(source, /Web\/PWA, IVR\/DTMF and SMS/);
  assert.match(source, /same database transaction/);
  assert.match(build, /Build 007 — Background Jobs, Scheduler & Operational Queues/);
});
