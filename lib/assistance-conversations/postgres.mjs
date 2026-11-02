import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { normalizeAssistanceReply } from "./core.mjs";

const { Pool } = pg;
let pool;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for case conversation.");
    pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function closeAssistanceConversationPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

function uuid(value, name) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!UUID.test(v)) throw new Error(`${name} must be a UUID.`);
  return v;
}

async function assertGuest(userId) {
  const result = await getPool().query(
    `select 1 from icamp_private.user_accounts
     where id=$1 and account_type='guest' and account_state='active' limit 1`,
    [userId],
  );
  if (result.rowCount !== 1)
    throw new Error("An active guest account is required.");
}

async function startRls(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
}

export async function postOwnAssistanceReply({
  userId,
  actorSessionId = null,
  requestId: rawRequestId,
  input: rawInput,
}) {
  await assertGuest(userId);
  const requestId = uuid(rawRequestId, "Assistance request");
  const input = normalizeAssistanceReply(rawInput);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const found = await client.query(
      `select c.id,c.case_state,c.organization_id,c.campground_id
       from public.camper_assistance_cases c
       join public.camper_assistance_requests r
         on r.id=c.request_id and r.organization_id=c.organization_id
         and r.campground_id=c.campground_id
       where r.id=$1 and r.guest_user_id=$2
       for update of c`,
      [requestId, userId],
    );
    const selected = found.rows[0];
    if (!selected) throw new Error("Your assistance case was not found.");
    if (selected.case_state === "closed") {
      throw new Error(
        "This case is closed. Start a new request if you still need help.",
      );
    }
    await startRls(client, userId);
    const inserted = await client.query(
      `insert into public.camper_assistance_case_events (
         organization_id,campground_id,case_id,event_kind,actor_user_id,
         source_channel,contact_channel,guest_visible,summary,metadata
       ) values ($1,$2,$3,'guest_reply',$4,'web','in_app',true,$5,$6::jsonb)
       on conflict do nothing returning id,occurred_at`,
      [
        selected.organization_id,
        selected.campground_id,
        selected.id,
        userId,
        input.message,
        JSON.stringify({
          clientMessageId: input.clientMessageId,
          deliveryMode: "in_app_only",
          externalDispatchClaimed: false,
        }),
      ],
    );
    await client.query("reset role");
    if (inserted.rowCount === 1) {
      await appendAuditEvent(client, {
        actorUserId: userId,
        actorSessionId,
        organizationId: selected.organization_id,
        campgroundId: selected.campground_id,
        actionKey: "camper_assistance.case.guest_in_app_reply",
        riskLevel: "standard",
        outcome: "succeeded",
        reason: "Guest in-app reply recorded without dispatch.",
        subjectType: "camper_assistance.case",
        subjectId: selected.id,
        metadata: {
          eventId: inserted.rows[0].id,
          requestId,
          bodyExcluded: true,
          externalDispatchClaimed: false,
        },
      });
    }
    await client.query("commit");
    return { recorded: inserted.rowCount === 1 };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listOwnAssistanceAttachments({
  userId,
  requestId: rawRequestId,
}) {
  await assertGuest(userId);
  const requestId = uuid(rawRequestId, "Assistance request");
  const result = await getPool().query(
    `select m.media_asset_id id,a.original_filename filename,a.content_type content_type,
       a.byte_size byte_size,m.created_at created_at
     from public.camper_assistance_request_media m
     join public.camper_assistance_requests r on r.id=m.request_id
       and r.organization_id=m.organization_id and r.campground_id=m.campground_id
     join icamp_private.media_assets a on a.id=m.media_asset_id
       and a.organization_id=m.organization_id and a.campground_id=m.campground_id
     where r.id=$1 and r.guest_user_id=$2
       and a.classification='internal' and a.validation_state='validated'
       and a.lifecycle_state='active'
     order by m.created_at,m.id`,
    [requestId, userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function listOwnAssistanceAttachmentsForStay({
  userId,
  reservationId: rawReservationId,
}) {
  await assertGuest(userId);
  const reservationId = uuid(rawReservationId, "Reservation");
  const result = await getPool().query(
    `select m.request_id,m.media_asset_id id,a.original_filename filename,
       a.content_type content_type,a.byte_size byte_size,m.created_at created_at
     from public.camper_assistance_request_media m
     join public.camper_assistance_requests r on r.id=m.request_id
       and r.organization_id=m.organization_id and r.campground_id=m.campground_id
     join icamp_private.media_assets a on a.id=m.media_asset_id
       and a.organization_id=m.organization_id and a.campground_id=m.campground_id
     where r.reservation_id=$1 and r.guest_user_id=$2
       and a.classification='internal' and a.validation_state='validated'
       and a.lifecycle_state='active'
     order by m.created_at,m.id`,
    [reservationId, userId],
  );
  return result.rows.map((row) => ({
    requestId: row.request_id,
    id: row.id,
    filename: row.filename,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function ownsAssistanceMedia({ userId, mediaId: rawMediaId }) {
  await assertGuest(userId);
  const mediaId = uuid(rawMediaId, "Media asset");
  const result = await getPool().query(
    `select 1 from public.camper_assistance_request_media m
     join public.camper_assistance_requests r on r.id=m.request_id
       and r.organization_id=m.organization_id and r.campground_id=m.campground_id
     join icamp_private.media_assets a on a.id=m.media_asset_id
       and a.organization_id=m.organization_id and a.campground_id=m.campground_id
     where m.media_asset_id=$1 and r.guest_user_id=$2
       and a.classification='internal' and a.validation_state='validated'
       and a.lifecycle_state='active' limit 1`,
    [mediaId, userId],
  );
  return result.rowCount === 1;
}

export async function listStaffAssistanceAttachments({
  userId,
  campgroundId: rawCampgroundId,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground");
  const grants = await Promise.all(
    [
      "assistance.triage",
      "assistance.communicate",
      "assistance.escalate",
      "assistance.close",
      "campground.operations.manage",
    ].map((p) => hasCampgroundPermission(userId, campgroundId, p)),
  );
  if (!grants.some(Boolean)) throw new Error("Assistance access is required.");
  const result = await getPool().query(
    `select c.id case_id,m.media_asset_id id,a.original_filename filename,
       a.content_type content_type,a.byte_size byte_size,m.created_at created_at
     from public.camper_assistance_cases c
     join public.camper_assistance_request_media m on m.request_id=c.request_id
       and m.organization_id=c.organization_id and m.campground_id=c.campground_id
     join icamp_private.media_assets a on a.id=m.media_asset_id
       and a.organization_id=m.organization_id and a.campground_id=m.campground_id
     where c.campground_id=$1 and a.classification='internal'
       and a.validation_state='validated' and a.lifecycle_state='active'
     order by m.created_at,m.id limit 500`,
    [campgroundId],
  );
  return result.rows.map((row) => ({
    caseId: row.case_id,
    id: row.id,
    filename: row.filename,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
