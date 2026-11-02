import pg from "pg";

import {
  SECURITY_DASHBOARD_EXPIRY_HOURS,
  SECURITY_DASHBOARD_RECENT_HOURS,
  normalizeSecurityDashboardLimit,
  securityDeviceNeedsAttention,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for the security dashboard.");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeSecurityDashboardPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function number(value) {
  return Number.parseInt(String(value ?? "0"), 10) || 0;
}

export async function listSecurityAccessDashboard({
  userId,
  campgroundId,
  now = new Date(),
  limit = 10,
}) {
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) {
    throw new Error("Security dashboard time is invalid.");
  }

  const rowLimit = normalizeSecurityDashboardLimit(limit);
  const currentIso = current.toISOString();
  const client = await getPool().connect();

  try {
    await beginRls(client, userId);

    const campgroundResult = await client.query(
      `select id,name,timezone
       from public.campgrounds
       where id=$1
       limit 1`,
      [campgroundId],
    );
    if (campgroundResult.rowCount !== 1) {
      throw new Error("Campground scope is unavailable.");
    }

    const devicesResult = await client.query(
      `select
         d.id,
         d.device_code,
         d.display_name,
         d.device_type,
         d.location_label,
         d.zone_reference,
         d.health_state,
         d.health_observed_at,
         d.is_active,
         latest.gate_state,
         latest.occurred_at as gate_state_observed_at
       from public.access_devices d
       left join lateral (
         select e.gate_state,e.occurred_at
         from public.access_device_events e
         where e.campground_id=d.campground_id
           and e.device_id=d.id
           and e.gate_state is not null
         order by e.occurred_at desc
         limit 1
       ) latest on true
       where d.campground_id=$1
       order by
         case d.health_state
           when 'offline' then 0
           when 'degraded' then 1
           when 'maintenance' then 2
           when 'unknown' then 3
           else 4
         end,
         d.display_name
       limit $2`,
      [campgroundId, rowLimit * 2],
    );

    const credentialsResult = await client.query(
      `select
         c.id,
         c.credential_number,
         c.credential_type,
         c.subject_kind,
         c.subject_label,
         c.valid_from,
         c.valid_until,
         count(*) over() as total_count
       from public.access_credentials c
       where c.campground_id=$1
         and c.status='active'
         and c.valid_from <= $2::timestamptz
         and (c.valid_until is null or c.valid_until > $2::timestamptz)
       order by c.valid_until asc nulls last,c.created_at desc
       limit $3`,
      [campgroundId, currentIso, rowLimit],
    );

    const deniedResult = await client.query(
      `select
         e.id,
         d.device_code,
         d.display_name as device_name,
         e.denied_reason,
         e.direction,
         e.occurred_at,
         e.credential_id is not null as has_credential,
         e.guest_profile_id is not null as has_guest,
         e.visitor_registration_id is not null as has_visitor,
         e.road_vehicle_registration_id is not null as has_vehicle,
         e.staff_user_id is not null as has_staff,
         count(*) over() as total_count
       from public.access_events e
       join public.access_devices d
         on d.organization_id=e.organization_id
        and d.campground_id=e.campground_id
        and d.id=e.device_id
       where e.campground_id=$1
         and e.outcome='denied'
       order by e.occurred_at desc
       limit $2`,
      [campgroundId, rowLimit],
    );

    const denied24Result = await client.query(
      `select count(*)::int as count
       from public.access_events
       where campground_id=$1
         and outcome='denied'
         and occurred_at >= $2::timestamptz
           - ($3::int * interval '1 hour')`,
      [campgroundId, currentIso, SECURITY_DASHBOARD_RECENT_HOURS],
    );

    const overridesResult = await client.query(
      `select
         r.id,
         d.device_code,
         d.display_name as device_name,
         r.command,
         r.reason,
         r.source_channel,
         r.requested_at,
         latest.outcome,
         latest.provider_status,
         latest.occurred_at as outcome_occurred_at,
         count(*) over() as total_count
       from public.gate_override_requests r
       join public.access_devices d
         on d.organization_id=r.organization_id
        and d.campground_id=r.campground_id
        and d.id=r.device_id
       left join lateral (
         select o.outcome,o.provider_status,o.occurred_at
         from public.gate_override_outcomes o
         where o.request_id=r.id
         order by o.occurred_at desc
         limit 1
       ) latest on true
       where r.campground_id=$1
       order by r.requested_at desc
       limit $2`,
      [campgroundId, rowLimit],
    );

    const override24Result = await client.query(
      `select count(*)::int as count
       from public.gate_override_requests
       where campground_id=$1
         and requested_at >= $2::timestamptz
           - ($3::int * interval '1 hour')`,
      [campgroundId, currentIso, SECURITY_DASHBOARD_RECENT_HOURS],
    );

    const expiringPassesResult = await client.query(
      `select
         p.id,
         p.pass_number,
         p.presentation_kind,
         p.link_kind,
         p.subject_label,
         c.valid_until,
         count(*) over() as total_count
       from public.access_passes p
       join public.access_credentials c
         on c.organization_id=p.organization_id
        and c.campground_id=p.campground_id
        and c.id=p.credential_id
       where p.campground_id=$1
         and c.status='active'
         and c.valid_until > $2::timestamptz
         and c.valid_until <= $2::timestamptz
           + ($3::int * interval '1 hour')
       order by c.valid_until asc
       limit $4`,
      [campgroundId, currentIso, SECURITY_DASHBOARD_EXPIRY_HOURS, rowLimit],
    );

    const signalsResult = await client.query(
      `select kind,subject,detail,occurred_at
       from (
         select
           'device_fault'::text as kind,
           d.display_name::text as subject,
           coalesce(e.health_state,'unknown')::text as detail,
           e.occurred_at
         from public.access_device_events e
         join public.access_devices d
           on d.organization_id=e.organization_id
          and d.campground_id=e.campground_id
          and d.id=e.device_id
         where e.campground_id=$1
           and e.event_kind='fault'

         union all

         select
           'denied_access'::text as kind,
           d.display_name::text as subject,
           e.denied_reason::text as detail,
           e.occurred_at
         from public.access_events e
         join public.access_devices d
           on d.organization_id=e.organization_id
          and d.campground_id=e.campground_id
          and d.id=e.device_id
         where e.campground_id=$1
           and e.outcome='denied'

         union all

         select
           'override_failure'::text as kind,
           d.display_name::text as subject,
           ('manual ' || r.command || ': ' || o.outcome)::text as detail,
           o.occurred_at
         from public.gate_override_outcomes o
         join public.gate_override_requests r
           on r.organization_id=o.organization_id
          and r.campground_id=o.campground_id
          and r.id=o.request_id
         join public.access_devices d
           on d.organization_id=r.organization_id
          and d.campground_id=r.campground_id
          and d.id=r.device_id
         where o.campground_id=$1
           and o.outcome in ('failed','rejected','timeout','unsupported')
       ) signals
       where occurred_at >= $2::timestamptz
         - ($3::int * interval '1 hour')
       order by occurred_at desc
       limit $4`,
      [campgroundId, currentIso, SECURITY_DASHBOARD_RECENT_HOURS, rowLimit],
    );

    await client.query("commit");

    const devices = devicesResult.rows.map((row) => ({
      id: row.id,
      deviceCode: row.device_code,
      displayName: row.display_name,
      deviceType: row.device_type,
      locationLabel: row.location_label ?? null,
      zoneReference: row.zone_reference ?? null,
      healthState: row.health_state,
      healthObservedAt: iso(row.health_observed_at),
      isActive: row.is_active,
      gateState: row.gate_state ?? "unknown",
      gateStateObservedAt: iso(row.gate_state_observed_at),
    }));

    const activeCredentials = credentialsResult.rows.map((row) => ({
      id: row.id,
      credentialNumber: row.credential_number,
      credentialType: row.credential_type,
      subjectKind: row.subject_kind,
      subjectLabel: row.subject_label,
      validFrom: iso(row.valid_from),
      validUntil: iso(row.valid_until),
    }));

    const deniedAccess = deniedResult.rows.map((row) => ({
      id: row.id,
      deviceCode: row.device_code,
      deviceName: row.device_name,
      deniedReason: row.denied_reason,
      direction: row.direction,
      occurredAt: iso(row.occurred_at),
      subjectKinds: [
        row.has_credential ? "credential" : null,
        row.has_guest ? "guest" : null,
        row.has_visitor ? "visitor" : null,
        row.has_vehicle ? "vehicle" : null,
        row.has_staff ? "staff" : null,
      ].filter(Boolean),
    }));

    const overrides = overridesResult.rows.map((row) => ({
      id: row.id,
      deviceCode: row.device_code,
      deviceName: row.device_name,
      command: row.command,
      reason: row.reason,
      sourceChannel: row.source_channel,
      requestedAt: iso(row.requested_at),
      outcome: row.outcome ?? "pending",
      providerStatus: row.provider_status ?? null,
      outcomeOccurredAt: iso(row.outcome_occurred_at),
    }));

    const expiringPasses = expiringPassesResult.rows.map((row) => ({
      id: row.id,
      passNumber: row.pass_number,
      presentationKind: row.presentation_kind,
      linkKind: row.link_kind,
      subjectLabel: row.subject_label,
      validUntil: iso(row.valid_until),
    }));

    const incidentSignals = signalsResult.rows.map((row) => ({
      kind: row.kind,
      subject: row.subject,
      detail: row.detail,
      occurredAt: iso(row.occurred_at),
    }));

    return {
      campground: {
        id: campgroundResult.rows[0].id,
        name: campgroundResult.rows[0].name,
        timeZone: campgroundResult.rows[0].timezone,
      },
      generatedAt: currentIso,
      windows: {
        recentHours: SECURITY_DASHBOARD_RECENT_HOURS,
        expiringHours: SECURITY_DASHBOARD_EXPIRY_HOURS,
      },
      summary: {
        deviceCount: devices.length,
        devicesNeedingAttention: devices.filter((device) =>
          securityDeviceNeedsAttention(device.healthState, device.isActive),
        ).length,
        openGateCount: devices.filter(
          (device) => device.isActive && device.gateState === "open",
        ).length,
        activeCredentialCount: number(credentialsResult.rows[0]?.total_count),
        deniedAccessRecentCount: number(denied24Result.rows[0]?.count),
        overrideRecentCount: number(override24Result.rows[0]?.count),
        expiringPassCount: number(expiringPassesResult.rows[0]?.total_count),
        incidentSignalCount: incidentSignals.length,
      },
      devices,
      activeCredentials,
      deniedAccess,
      overrides,
      expiringPasses,
      incidentSignals,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
