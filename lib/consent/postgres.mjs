import { createHash } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  DEFAULT_MESSAGING_COMPLIANCE_RULE,
  deriveMessagingPreferenceTransition,
  evaluateMessagingDispatchPermission,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "DATABASE_URL is required for messaging consent operations.",
    );
  }
  return value;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

async function assertPermission(actorUserId, campgroundId, permission) {
  const allowed = await hasCampgroundPermission(
    actorUserId,
    campgroundId,
    permission,
  );
  if (!allowed) {
    throw new Error("Not authorized for messaging consent operation.");
  }
}

function normalizeJurisdictionCode(value) {
  const code = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/u.test(code)) {
    throw new Error("Messaging jurisdiction code is invalid.");
  }

  return code;
}

function mapRule(row) {
  if (!row) return { ...DEFAULT_MESSAGING_COMPLIANCE_RULE };

  return {
    id: row.id,
    jurisdictionCode: row.jurisdiction_code,
    marketingRequiresConsent: row.marketing_requires_consent,
    marketingConsentExpiryDays:
      row.marketing_consent_expiry_days === null
        ? null
        : Number(row.marketing_consent_expiry_days),
    stopSuppressesAll: row.stop_suppresses_all,
    startGrantsMarketingConsent: row.start_grants_marketing_consent,
    helpAllowedWhenSuppressed: row.help_allowed_when_suppressed,
  };
}

async function resolveRule(client, campgroundId, jurisdictionCode = null) {
  const code = jurisdictionCode
    ? normalizeJurisdictionCode(jurisdictionCode)
    : null;

  const result = await client.query(
    `select *
     from icamp_private.communication_compliance_rules
     where campground_id = $1
       and lifecycle_state = 'active'
       and effective_from <= statement_timestamp()
       and (
         ($2::text is not null and jurisdiction_code = $2)
         or ($2::text is null and is_default)
       )
     order by
       case when jurisdiction_code = $2 then 0 else 1 end,
       effective_from desc
     limit 1`,
    [campgroundId, code],
  );

  return mapRule(result.rows[0]);
}

function providerEventKey(providerKey, providerEventId) {
  const digest = createHash("sha256")
    .update(providerKey)
    .update(":")
    .update(providerEventId)
    .digest("hex");
  return "provider:" + digest;
}

async function upsertPurposePreference(
  client,
  endpointId,
  purpose,
  channel,
  preferenceState,
  source,
  updatedByUserId = null,
) {
  await client.query(
    `insert into icamp_private.communication_preferences (
       endpoint_id,
       purpose,
       channel,
       preference_state,
       source,
       updated_by_user_id
     )
     values ($1, $2, $3, $4, $5, $6)
     on conflict (endpoint_id, purpose, channel)
     do update set
       preference_state = excluded.preference_state,
       source = excluded.source,
       updated_by_user_id = excluded.updated_by_user_id`,
    [endpointId, purpose, channel, preferenceState, source, updatedByUserId],
  );
}

async function appendConsent(
  client,
  {
    endpointId,
    purpose,
    channel,
    consentState,
    evidenceSource,
    evidenceReference,
    recordedByUserId = null,
    occurredAt = null,
  },
) {
  const result = await client.query(
    `insert into icamp_private.communication_consents (
       endpoint_id,
       purpose,
       channel,
       consent_state,
       evidence_source,
       evidence_reference,
       recorded_by_user_id,
       occurred_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, coalesce($8::timestamptz, statement_timestamp()))
     returning id, occurred_at`,
    [
      endpointId,
      purpose,
      channel,
      consentState,
      evidenceSource,
      evidenceReference,
      recordedByUserId,
      occurredAt,
    ],
  );
  return result.rows[0];
}

export async function configureMessagingComplianceRule({
  actorUserId,
  organizationId,
  campgroundId,
  jurisdictionCode,
  isDefault = false,
  marketingRequiresConsent = true,
  marketingConsentExpiryDays = null,
  stopSuppressesAll = true,
  startGrantsMarketingConsent = false,
  helpAllowedWhenSuppressed = true,
  reason = "Configure messaging compliance rule.",
}) {
  await assertPermission(actorUserId, campgroundId, "communications.manage");
  const code = normalizeJurisdictionCode(jurisdictionCode);

  if (
    marketingConsentExpiryDays !== null &&
    (!Number.isInteger(marketingConsentExpiryDays) ||
      marketingConsentExpiryDays < 1 ||
      marketingConsentExpiryDays > 3650)
  ) {
    throw new Error("Marketing consent expiry days must be 1 to 3650 or null.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");

    if (isDefault) {
      await client.query(
        `update icamp_private.communication_compliance_rules
         set is_default = false
         where campground_id = $1
           and is_default
           and jurisdiction_code <> $2`,
        [campgroundId, code],
      );
    }

    const result = await client.query(
      `insert into icamp_private.communication_compliance_rules (
         organization_id,
         campground_id,
         jurisdiction_code,
         is_default,
         marketing_requires_consent,
         marketing_consent_expiry_days,
         stop_suppresses_all,
         start_grants_marketing_consent,
         help_allowed_when_suppressed
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (campground_id, jurisdiction_code)
       do update set
         organization_id = excluded.organization_id,
         is_default = excluded.is_default,
         marketing_requires_consent = excluded.marketing_requires_consent,
         marketing_consent_expiry_days = excluded.marketing_consent_expiry_days,
         stop_suppresses_all = excluded.stop_suppresses_all,
         start_grants_marketing_consent = excluded.start_grants_marketing_consent,
         help_allowed_when_suppressed = excluded.help_allowed_when_suppressed,
         lifecycle_state = 'active',
         effective_from = statement_timestamp()
       returning *`,
      [
        organizationId,
        campgroundId,
        code,
        isDefault,
        marketingRequiresConsent,
        marketingConsentExpiryDays,
        stopSuppressesAll,
        startGrantsMarketingConsent,
        helpAllowedWhenSuppressed,
      ],
    );

    const row = result.rows[0];

    await appendAuditEvent(client, {
      actorUserId,
      organizationId,
      campgroundId,
      actionKey: "communications.compliance_rule.upsert",
      permissionKey: "communications.manage",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason,
      subjectType: "communications.compliance_rule",
      subjectId: row.id,
      afterState: {
        jurisdictionCode: row.jurisdiction_code,
        isDefault: row.is_default,
        marketingRequiresConsent: row.marketing_requires_consent,
        marketingConsentExpiryDays: row.marketing_consent_expiry_days,
        stopSuppressesAll: row.stop_suppresses_all,
        startGrantsMarketingConsent: row.start_grants_marketing_consent,
        helpAllowedWhenSuppressed: row.help_allowed_when_suppressed,
      },
    });

    await client.query("commit");
    return mapRule(row);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function applyMessagingPreferenceKeywordInTransaction(
  client,
  {
    organizationId,
    campgroundId,
    endpointId,
    providerKey,
    providerEventId,
    action,
    occurredAt,
    jurisdictionCode = null,
  },
) {
  if (!["stop", "start", "help"].includes(action)) {
    throw new Error("Messaging preference keyword action is invalid.");
  }

  const existing = await client.query(
    `select id
     from icamp_private.messaging_preference_events
     where provider_key = $1
       and provider_event_id = $2
     limit 1`,
    [providerKey, providerEventId],
  );

  if (existing.rowCount === 1) {
    const state = await client.query(
      `select provider_suppressed, jurisdiction_code
       from icamp_private.messaging_preference_state
       where endpoint_id = $1`,
      [endpointId],
    );

    return {
      duplicate: true,
      action,
      providerSuppressed: Boolean(state.rows[0]?.provider_suppressed),
      jurisdictionCode:
        state.rows[0]?.jurisdiction_code ??
        DEFAULT_MESSAGING_COMPLIANCE_RULE.jurisdictionCode,
    };
  }

  const endpoint = await client.query(
    `select id
     from icamp_private.communication_endpoints
     where id = $1
       and organization_id = $2
       and campground_id = $3
       and endpoint_kind = 'phone'
       and lifecycle_state = 'active'
     limit 1`,
    [endpointId, organizationId, campgroundId],
  );

  if (endpoint.rowCount !== 1) {
    throw new Error(
      "Messaging preference endpoint was not found in campground.",
    );
  }

  const current = await client.query(
    `select provider_suppressed, jurisdiction_code
     from icamp_private.messaging_preference_state
     where endpoint_id = $1`,
    [endpointId],
  );

  const rule = await resolveRule(
    client,
    campgroundId,
    jurisdictionCode ?? current.rows[0]?.jurisdiction_code ?? null,
  );
  const transition = deriveMessagingPreferenceTransition({
    action,
    currentlySuppressed: Boolean(current.rows[0]?.provider_suppressed),
    rule,
  });

  const state = await client.query(
    `insert into icamp_private.messaging_preference_state (
       endpoint_id,
       jurisdiction_code,
       provider_suppressed,
       suppression_source,
       last_action,
       last_provider_key,
       last_changed_at
     )
     values ($1, $2, $3, 'provider', $4, $5, $6)
     on conflict (endpoint_id)
     do update set
       jurisdiction_code = excluded.jurisdiction_code,
       provider_suppressed = excluded.provider_suppressed,
       suppression_source = excluded.suppression_source,
       last_action = excluded.last_action,
       last_provider_key = excluded.last_provider_key,
       last_changed_at = excluded.last_changed_at
     returning *`,
    [
      endpointId,
      rule.jurisdictionCode,
      transition.providerSuppressed,
      action,
      providerKey,
      occurredAt,
    ],
  );

  const evidenceReference = `provider:${providerKey}:${providerEventId}`.slice(
    0,
    240,
  );

  if (transition.marketingPreference !== "unchanged") {
    for (const channel of ["sms", "mms"]) {
      await upsertPurposePreference(
        client,
        endpointId,
        "marketing",
        channel,
        transition.marketingPreference,
        "provider",
      );
      await appendConsent(client, {
        endpointId,
        purpose: "marketing",
        channel,
        consentState: transition.marketingConsent,
        evidenceSource: "provider",
        evidenceReference,
        occurredAt,
      });
    }
  }

  await client.query(
    `insert into icamp_private.messaging_preference_events (
       endpoint_id,
       event_key,
       provider_key,
       provider_event_id,
       action,
       source,
       resulting_provider_suppressed,
       jurisdiction_code,
       metadata,
       occurred_at
     )
     values (
       $1, $2, $3, $4, $5, 'provider', $6, $7,
       $8::jsonb, $9
     )`,
    [
      endpointId,
      providerEventKey(providerKey, providerEventId),
      providerKey,
      providerEventId,
      action,
      transition.providerSuppressed,
      rule.jurisdictionCode,
      JSON.stringify({
        rawMessageExcluded: true,
        endpointValueExcluded: true,
        marketingConsentRestoredByStart:
          action === "start" && rule.startGrantsMarketingConsent,
      }),
      occurredAt,
    ],
  );

  return {
    duplicate: false,
    action,
    providerSuppressed: state.rows[0].provider_suppressed,
    jurisdictionCode: state.rows[0].jurisdiction_code,
  };
}

export async function applyMessagingPreferenceKeyword(input) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await applyMessagingPreferenceKeywordInTransaction(
      client,
      input,
    );
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordMessagingMarketingConsent({
  actorUserId,
  organizationId,
  campgroundId,
  endpointId,
  channel = "sms",
  consentState,
  evidenceSource = "user",
  evidenceReference = null,
  reason = "Record explicit messaging marketing consent.",
}) {
  await assertPermission(actorUserId, campgroundId, "communications.manage");

  if (!["sms", "mms"].includes(channel)) {
    throw new Error("Messaging marketing consent channel is invalid.");
  }
  if (!["granted", "withdrawn"].includes(consentState)) {
    throw new Error("Messaging marketing consent state is invalid.");
  }
  if (!["user", "staff", "import"].includes(evidenceSource)) {
    throw new Error("Messaging marketing consent evidence source is invalid.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");

    const endpoint = await client.query(
      `select id
       from icamp_private.communication_endpoints
       where id = $1
         and organization_id = $2
         and campground_id = $3
         and endpoint_kind = 'phone'
         and lifecycle_state = 'active'
       limit 1`,
      [endpointId, organizationId, campgroundId],
    );
    if (endpoint.rowCount !== 1) {
      throw new Error(
        "Messaging marketing endpoint was not found in campground.",
      );
    }

    const preferenceState = consentState === "granted" ? "enabled" : "disabled";
    await upsertPurposePreference(
      client,
      endpointId,
      "marketing",
      channel,
      preferenceState,
      evidenceSource === "import" ? "system" : evidenceSource,
      actorUserId,
    );

    const consent = await appendConsent(client, {
      endpointId,
      purpose: "marketing",
      channel,
      consentState,
      evidenceSource,
      evidenceReference,
      recordedByUserId: actorUserId,
    });

    const state = await client.query(
      `select provider_suppressed, jurisdiction_code
       from icamp_private.messaging_preference_state
       where endpoint_id = $1`,
      [endpointId],
    );

    await client.query(
      `insert into icamp_private.messaging_preference_events (
         endpoint_id,
         event_key,
         action,
         source,
         resulting_provider_suppressed,
         jurisdiction_code,
         metadata,
         occurred_at
       )
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        endpointId,
        "consent:" + consent.id,
        consentState === "granted" ? "marketing_opt_in" : "marketing_opt_out",
        evidenceSource,
        Boolean(state.rows[0]?.provider_suppressed),
        state.rows[0]?.jurisdiction_code ??
          DEFAULT_MESSAGING_COMPLIANCE_RULE.jurisdictionCode,
        JSON.stringify({
          endpointValueExcluded: true,
          consentEvidenceReferencePresent: Boolean(evidenceReference),
        }),
        consent.occurred_at,
      ],
    );

    await appendAuditEvent(client, {
      actorUserId,
      organizationId,
      campgroundId,
      actionKey: "communications.messaging_marketing_consent.record",
      permissionKey: "communications.manage",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason,
      subjectType: "communications.consent",
      subjectId: consent.id,
      afterState: {
        purpose: "marketing",
        channel,
        consentState,
        preferenceState,
      },
      metadata: {
        endpointValueExcluded: true,
      },
    });

    await client.query("commit");
    return {
      id: consent.id,
      consentState,
      channel,
      occurredAt:
        consent.occurred_at instanceof Date
          ? consent.occurred_at.toISOString()
          : consent.occurred_at,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function assertMessagingDispatchAllowed({
  campgroundId,
  endpointId,
  purpose,
  channel,
  messageKind = "normal",
  now = new Date(),
}) {
  if (!["sms", "mms"].includes(channel)) {
    throw new Error("Messaging compliance channel is invalid.");
  }

  const client = await getPool().connect();
  try {
    const endpoint = await client.query(
      `select id
       from icamp_private.communication_endpoints
       where id = $1
         and campground_id = $2
         and endpoint_kind = 'phone'
         and lifecycle_state = 'active'
       limit 1`,
      [endpointId, campgroundId],
    );
    if (endpoint.rowCount !== 1) {
      throw new Error("Messaging destination endpoint was not found.");
    }

    const state = await client.query(
      `select provider_suppressed, jurisdiction_code
       from icamp_private.messaging_preference_state
       where endpoint_id = $1`,
      [endpointId],
    );
    const rule = await resolveRule(
      client,
      campgroundId,
      state.rows[0]?.jurisdiction_code ?? null,
    );
    const preference = await client.query(
      `select preference_state
       from icamp_private.communication_preferences
       where endpoint_id = $1
         and purpose = $2
         and channel = $3
       limit 1`,
      [endpointId, purpose, channel],
    );
    const consent = await client.query(
      `select consent_state, occurred_at
       from icamp_private.communication_consents
       where endpoint_id = $1
         and purpose = $2
         and channel = $3
       order by occurred_at desc, id desc
       limit 1`,
      [endpointId, purpose, channel],
    );

    const decision = evaluateMessagingDispatchPermission({
      purpose,
      preferenceState: preference.rows[0]?.preference_state ?? null,
      consentState: consent.rows[0]?.consent_state ?? null,
      consentOccurredAt: consent.rows[0]?.occurred_at ?? null,
      providerSuppressed: Boolean(state.rows[0]?.provider_suppressed),
      messageKind,
      rule,
      now,
    });

    if (!decision.allowed) {
      throw new Error(
        "Messaging dispatch blocked by consent/preference policy: " +
          decision.reason,
      );
    }

    return {
      allowed: true,
      reason: decision.reason,
      jurisdictionCode: rule.jurisdictionCode,
    };
  } finally {
    client.release();
  }
}

export async function getMessagingConsentHealth() {
  const [states, events, rules, latestMarketing] = await Promise.all([
    getPool().query(
      `select
         count(*)::integer as tracked,
         count(*) filter (where provider_suppressed)::integer as suppressed
       from icamp_private.messaging_preference_state`,
    ),
    getPool().query(
      `select
         count(*) filter (
           where occurred_at >= statement_timestamp() - interval '24 hours'
             and action = 'stop'
         )::integer as stop_24h,
         count(*) filter (
           where occurred_at >= statement_timestamp() - interval '24 hours'
             and action = 'start'
         )::integer as start_24h,
         count(*) filter (
           where occurred_at >= statement_timestamp() - interval '24 hours'
             and action = 'help'
         )::integer as help_24h
       from icamp_private.messaging_preference_events`,
    ),
    getPool().query(
      `select count(*) filter (
         where lifecycle_state = 'active'
       )::integer as active
       from icamp_private.communication_compliance_rules`,
    ),
    getPool().query(
      `with latest as (
         select distinct on (endpoint_id, channel)
           endpoint_id,
           channel,
           consent_state
         from icamp_private.communication_consents
         where purpose = 'marketing'
           and channel in ('sms', 'mms')
         order by endpoint_id, channel, occurred_at desc, id desc
       )
       select
         count(*) filter (where consent_state = 'granted')::integer as granted,
         count(*) filter (where consent_state = 'withdrawn')::integer as withdrawn
       from latest`,
    ),
  ]);

  return {
    status: "operational",
    endpoints: {
      tracked: Number(states.rows[0].tracked),
      providerSuppressed: Number(states.rows[0].suppressed),
    },
    keywords24h: {
      stop: Number(events.rows[0].stop_24h),
      start: Number(events.rows[0].start_24h),
      help: Number(events.rows[0].help_24h),
    },
    marketing: {
      granted: Number(latestMarketing.rows[0].granted),
      withdrawn: Number(latestMarketing.rows[0].withdrawn),
    },
    complianceRules: {
      active: Number(rules.rows[0].active),
      safeFallbackJurisdiction:
        DEFAULT_MESSAGING_COMPLIANCE_RULE.jurisdictionCode,
    },
    privacy: {
      endpointValuesExcluded: true,
      messageBodiesExcluded: true,
    },
  };
}

export async function closeMessagingConsentPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
