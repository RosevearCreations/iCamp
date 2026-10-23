import pg from "pg";

import {
  normalizeCamperAssistanceClientRequestId,
  normalizeCamperAssistanceInput,
  normalizeCamperAssistanceSource,
} from "./core.mjs";

const { Pool } = pg;
let pool;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for camper assistance.");
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

export async function closeCamperAssistancePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertGuestAccount(userId) {
  const result = await getPool().query(
    `select 1
     from icamp_private.user_accounts
     where id=$1 and account_type='guest' and account_state='active'
     limit 1`,
    [userId],
  );
  if (result.rowCount !== 1) {
    throw new Error("An active guest account is required for assistance.");
  }
}

async function beginRls(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
}

function uuid(value, label) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(label + " must be a UUID.");
  }
  return normalized;
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function mapRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    reservationId: row.reservation_id,
    accommodationId: row.accommodation_id,
    category: row.category,
    severity: row.severity,
    summary: row.summary,
    details: row.details ?? null,
    contactPreference: row.contact_preference,
    sourceChannel: row.source_channel,
    requestState: row.request_state,
    submittedAt: iso(row.submitted_at),
    rowVersion: Number(row.row_version),
    mediaCount: Number(row.media_count ?? 0),
  };
}

function sameSubmission(row, reservationId, sourceChannel, input) {
  return (
    row.reservation_id === reservationId &&
    row.category === input.category &&
    row.severity === input.severity &&
    row.summary === input.summary &&
    (row.details ?? null) === input.details &&
    row.contact_preference === input.contactPreference &&
    row.source_channel === sourceChannel
  );
}

async function checkedInStay(client, userId, reservationId) {
  const result = await client.query(
    `select
       r.id,
       r.organization_id,
       r.campground_id,
       r.accommodation_id,
       r.guest_user_id,
       r.status,
       c.name campground_name,
       a.code accommodation_code,
       a.display_name accommodation_name
     from public.reservations r
     join public.campgrounds c on c.id=r.campground_id
     join public.accommodations a on a.id=r.accommodation_id
     where r.id=$1
       and r.guest_user_id=$2
       and r.status='checked_in'
     limit 1`,
    [reservationId, userId],
  );
  if (result.rowCount !== 1) {
    throw new Error(
      "A checked-in reservation linked to your account is required.",
    );
  }
  return result.rows[0];
}

export async function createCamperAssistanceRequest({
  userId,
  reservationId: rawReservationId,
  clientRequestId: rawClientRequestId,
  sourceChannel: rawSourceChannel = "web",
  input: rawInput,
}) {
  await assertGuestAccount(userId);
  const reservationId = uuid(rawReservationId, "Reservation id");
  const clientRequestId =
    normalizeCamperAssistanceClientRequestId(rawClientRequestId);
  const sourceChannel = normalizeCamperAssistanceSource(rawSourceChannel);
  const input = normalizeCamperAssistanceInput(rawInput);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const stay = await checkedInStay(client, userId, reservationId);

    const existingResult = await client.query(
      `select *
       from public.camper_assistance_requests
       where guest_user_id=$1
         and campground_id=$2
         and client_request_id=$3
       limit 1`,
      [userId, stay.campground_id, clientRequestId],
    );
    if (existingResult.rowCount === 1) {
      const existing = existingResult.rows[0];
      if (!sameSubmission(existing, reservationId, sourceChannel, input)) {
        throw new Error(
          "This assistance submission key was already used for different request details.",
        );
      }
      await client.query("commit");
      return { status: "already_submitted", request: mapRequest(existing) };
    }

    await beginRls(client, userId);
    const inserted = await client.query(
      `insert into public.camper_assistance_requests (
         organization_id,
         campground_id,
         reservation_id,
         accommodation_id,
         guest_user_id,
         category,
         severity,
         summary,
         details,
         contact_preference,
         source_channel,
         client_request_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (guest_user_id,campground_id,client_request_id) do nothing
       returning *`,
      [
        stay.organization_id,
        stay.campground_id,
        reservationId,
        stay.accommodation_id,
        userId,
        input.category,
        input.severity,
        input.summary,
        input.details,
        input.contactPreference,
        sourceChannel,
        clientRequestId,
      ],
    );

    let request = inserted.rows[0];
    if (!request) {
      const concurrent = await client.query(
        `select *
         from public.camper_assistance_requests
         where guest_user_id=$1
           and campground_id=$2
           and client_request_id=$3
         limit 1`,
        [userId, stay.campground_id, clientRequestId],
      );
      request = concurrent.rows[0];
      if (
        !request ||
        !sameSubmission(request, reservationId, sourceChannel, input)
      ) {
        throw new Error(
          "A concurrent assistance submission used the same key with different details.",
        );
      }
      await client.query("commit");
      return { status: "already_submitted", request: mapRequest(request) };
    }

    await client.query(
      `insert into public.camper_assistance_request_events (
         organization_id,
         campground_id,
         request_id,
         event_kind,
         actor_user_id,
         source_channel,
         summary,
         metadata
       ) values ($1,$2,$3,'submitted',$4,$5,$6,$7::jsonb)`,
      [
        stay.organization_id,
        stay.campground_id,
        request.id,
        userId,
        sourceChannel,
        "Camper assistance request submitted.",
        JSON.stringify({
          category: input.category,
          severity: input.severity,
          reservationId,
          accommodationId: stay.accommodation_id,
        }),
      ],
    );

    await client.query("commit");
    return { status: "submitted", request: mapRequest(request) };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listCamperAssistanceRequests({
  userId,
  reservationId: rawReservationId,
}) {
  await assertGuestAccount(userId);
  const reservationId = uuid(rawReservationId, "Reservation id");
  const result = await getPool().query(
    `select
       r.*,
       (
         select count(*)::integer
         from public.camper_assistance_request_media m
         where m.request_id=r.id
       ) media_count
     from public.camper_assistance_requests r
     where r.guest_user_id=$1
       and r.reservation_id=$2
     order by r.submitted_at desc, r.id desc`,
    [userId, reservationId],
  );
  return result.rows.map(mapRequest);
}

export async function getCamperAssistanceRequestForMedia({
  userId,
  requestId: rawRequestId,
}) {
  await assertGuestAccount(userId);
  const requestId = uuid(rawRequestId, "Assistance request id");
  const result = await getPool().query(
    `select
       r.*,
       (
         select count(*)::integer
         from public.camper_assistance_request_media m
         where m.request_id=r.id
       ) media_count
     from public.camper_assistance_requests r
     where r.id=$1 and r.guest_user_id=$2
     limit 1`,
    [requestId, userId],
  );
  return mapRequest(result.rows[0]);
}

export async function attachCamperAssistanceMediaEvidence({
  userId,
  requestId: rawRequestId,
  media,
}) {
  await assertGuestAccount(userId);
  const requestId = uuid(rawRequestId, "Assistance request id");
  const mediaId = uuid(media.id, "Media id");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "icamp-assistance-media:" + requestId,
    ]);

    const requestResult = await client.query(
      `select *
       from public.camper_assistance_requests
       where id=$1 and guest_user_id=$2
       limit 1
       for update`,
      [requestId, userId],
    );
    const request = requestResult.rows[0];
    if (!request) {
      throw new Error("Assistance request was not found.");
    }

    const countResult = await client.query(
      `select count(*)::integer media_count
       from public.camper_assistance_request_media
       where request_id=$1`,
      [requestId],
    );
    if (Number(countResult.rows[0]?.media_count ?? 0) >= 5) {
      throw new Error(
        "A maximum of five media attachments is supported per assistance request.",
      );
    }

    await client.query(
      `insert into icamp_private.media_assets (
         id,organization_id,campground_id,classification,media_kind,
         storage_provider,bucket_key,object_key,original_filename,content_type,
         byte_size,checksum_sha256,validation_state,lifecycle_state,
         created_by_user_id,activated_at
       ) values (
         $1,$2,$3,'internal',$4,'supabase',$5,$6,$7,$8,$9,$10,
         'validated','active',$11,statement_timestamp()
       )`,
      [
        mediaId,
        request.organization_id,
        request.campground_id,
        media.mediaKind,
        media.bucketKey,
        media.objectKey,
        media.originalFilename,
        media.contentType,
        media.byteSize,
        media.checksumSha256,
        userId,
      ],
    );

    await client.query(
      `insert into icamp_private.media_lifecycle_events (
         media_asset_id,event_type,from_state,to_state,actor_user_id,reason,
         metadata
       ) values
         ($1,'registered',null,'pending',$2,$3,$4::jsonb),
         ($1,'activated','pending','active',$2,$3,$4::jsonb)`,
      [
        mediaId,
        userId,
        "Camper assistance evidence uploaded through the validated guest intake.",
        JSON.stringify({
          source: "camper.assistance",
          requestId,
        }),
      ],
    );

    await beginRls(client, userId);
    const link = await client.query(
      `insert into public.camper_assistance_request_media (
         organization_id,
         campground_id,
         request_id,
         media_asset_id,
         created_by_user_id
       ) values ($1,$2,$3,$4,$5)
       returning id`,
      [
        request.organization_id,
        request.campground_id,
        requestId,
        mediaId,
        userId,
      ],
    );

    await client.query(
      `insert into public.camper_assistance_request_events (
         organization_id,
         campground_id,
         request_id,
         event_kind,
         actor_user_id,
         source_channel,
         summary,
         metadata
       ) values ($1,$2,$3,'media_attached',$4,'web',$5,$6::jsonb)`,
      [
        request.organization_id,
        request.campground_id,
        requestId,
        userId,
        "Validated internal media attached to camper assistance request.",
        JSON.stringify({
          mediaAssetId: mediaId,
          requestMediaId: link.rows[0].id,
        }),
      ],
    );

    await client.query("commit");
    return {
      mediaAssetId: mediaId,
      requestMediaId: link.rows[0].id,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
