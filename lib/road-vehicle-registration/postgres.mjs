import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeRoadVehicleRegistrationInput,
  normalizeRoadVehicleRevocationReason,
  normalizeRoadVehicleSourceChannel,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is required for road vehicle registration.",
      );
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function closeRoadVehicleRegistrationPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function vehiclePermissions(userId, campgroundId) {
  const [read, register] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "vehicle.read"),
    hasCampgroundPermission(userId, campgroundId, "vehicle.register"),
  ]);
  return { read, register };
}

async function assertVehicleRead(userId, campgroundId) {
  const permissions = await vehiclePermissions(userId, campgroundId);
  if (!permissions.read && !permissions.register) {
    throw new Error("Not authorized to read road vehicle registrations.");
  }
  return permissions;
}

async function assertVehicleRegister(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(userId, campgroundId, "vehicle.register"))
  ) {
    throw new Error("Road vehicle registration permission is required.");
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function iso(value) {
  if (value == null) return null;
  return new Date(value).toISOString();
}

function isoDate(value) {
  if (value == null) return null;
  return String(value).slice(0, 10);
}

function mapRegistration(row) {
  return {
    id: row.id,
    reservationId: row.reservation_id ?? null,
    guestProfileId: row.guest_profile_id ?? null,
    guestVehicleProfileId: row.guest_vehicle_profile_id ?? null,
    hostAccommodationId: row.host_accommodation_id,
    hostAccommodationLabel: row.host_accommodation_label,
    vehicleKind: row.vehicle_kind,
    plateNumber: row.plate_number,
    plateJurisdiction: row.plate_jurisdiction,
    vehicleDescription: row.vehicle_description,
    registeredOwnerName: row.registered_owner_name,
    primaryDriverName: row.primary_driver_name,
    validFrom: isoDate(row.valid_from),
    validUntil: isoDate(row.valid_until),
    registrationStatus: row.registration_status,
    effectiveStatus: row.effective_status ?? row.registration_status,
    revokedAt: iso(row.revoked_at),
    revocationReason: row.revocation_reason ?? null,
    sourceChannel: row.source_channel,
    notes: row.notes ?? null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    rowVersion: Number(row.row_version),
  };
}

function requiredId(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(label + " is required.");
  return normalized;
}

function optionalId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeIdempotencyKey(value) {
  const key = String(value ?? "").trim();
  if (key.length < 8 || key.length > 200) {
    throw new Error("Vehicle registration idempotency key is invalid.");
  }
  return key;
}

async function insertLifecycleEvent(
  client,
  {
    row,
    actorUserId,
    eventKind,
    priorStatus,
    newStatus,
    reason,
    sourceChannel,
  },
) {
  await client.query(
    `insert into public.road_vehicle_registration_events (
       organization_id,campground_id,registration_id,event_kind,
       prior_status,new_status,reason,source_channel,actor_user_id
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      row.organization_id,
      row.campground_id,
      row.id,
      eventKind,
      priorStatus,
      newStatus,
      reason,
      sourceChannel,
      actorUserId,
    ],
  );
}

export async function listRoadVehicleRegistrationDesk({
  userId,
  campgroundId,
}) {
  const permissions = await assertVehicleRead(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await beginRls(client, userId);

    const campgroundResult = await client.query(
      `select
         id,
         organization_id,
         display_name,
         time_zone,
         (statement_timestamp() at time zone time_zone)::date local_date
       from public.campgrounds
       where id=$1
       limit 1`,
      [campgroundId],
    );
    if (campgroundResult.rowCount !== 1) {
      throw new Error("Campground was not found.");
    }

    const campground = campgroundResult.rows[0];
    const registrationsResult = await client.query(
      `select
         r.*,
         case
           when r.registration_status='active'
            and r.valid_until < $2::date then 'expired'
           else r.registration_status
         end effective_status
       from public.road_vehicle_registrations r
       where r.campground_id=$1
       order by
         case when r.registration_status='active' and r.valid_until >= $2::date then 0 else 1 end,
         r.valid_until desc,
         r.created_at desc
       limit 500`,
      [campgroundId, isoDate(campground.local_date)],
    );

    let accommodations = [];
    let reservations = [];
    let savedVehicles = [];

    if (permissions.register) {
      const [accommodationResult, reservationResult, savedVehicleResult] =
        await Promise.all([
          client.query(
            `select id,code,display_name,accommodation_kind,status_state
             from public.accommodations
             where campground_id=$1 and lifecycle_state='active'
             order by code,display_name`,
            [campgroundId],
          ),
          client.query(
            `select
               r.id,
               r.accommodation_id,
               r.guest_profile_id,
               r.arrival_date,
               r.departure_date,
               r.status,
               a.code accommodation_code,
               a.display_name accommodation_name,
               trim(
                 coalesce(rcd.primary_first_name,'') || ' ' ||
                 coalesce(rcd.primary_last_name,'')
               ) guest_name
             from public.reservations r
             join public.accommodations a on a.id=r.accommodation_id
             left join public.reservation_checkout_details rcd
               on rcd.reservation_id=r.id
             where r.campground_id=$1
               and r.status in ('pending','confirmed','checked_in')
             order by r.arrival_date desc,r.created_at desc
             limit 250`,
            [campgroundId],
          ),
          client.query(
            `select
               v.id,
               v.guest_profile_id,
               v.nickname,
               v.vehicle_kind,
               v.make,
               v.model,
               v.color,
               v.model_year,
               g.first_name,
               g.last_name
             from public.guest_vehicle_profiles v
             join public.guest_profiles g on g.id=v.guest_profile_id
             where v.campground_id=$1
               and v.profile_state='active'
               and g.profile_state='active'
             order by g.last_name,g.first_name,v.nickname
             limit 500`,
            [campgroundId],
          ),
        ]);

      accommodations = accommodationResult.rows.map((row) => ({
        id: row.id,
        code: row.code,
        displayName: row.display_name,
        accommodationKind: row.accommodation_kind,
        statusState: row.status_state,
      }));

      reservations = reservationResult.rows.map((row) => ({
        id: row.id,
        accommodationId: row.accommodation_id,
        guestProfileId: row.guest_profile_id ?? null,
        arrivalDate: isoDate(row.arrival_date),
        departureDate: isoDate(row.departure_date),
        status: row.status,
        accommodationCode: row.accommodation_code,
        accommodationName: row.accommodation_name,
        guestName: row.guest_name || "Reservation guest",
      }));

      savedVehicles = savedVehicleResult.rows.map((row) => ({
        id: row.id,
        guestProfileId: row.guest_profile_id,
        nickname: row.nickname,
        vehicleKind: row.vehicle_kind,
        make: row.make ?? null,
        model: row.model ?? null,
        color: row.color ?? null,
        modelYear: row.model_year == null ? null : Number(row.model_year),
        guestName: (row.first_name + " " + row.last_name).trim(),
      }));
    }

    await client.query("commit");

    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        displayName: campground.display_name,
        timeZone: campground.time_zone,
        localDate: isoDate(campground.local_date),
      },
      registrations: registrationsResult.rows.map(mapRegistration),
      accommodations,
      reservations,
      savedVehicles,
      canRegister: permissions.register,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createRoadVehicleRegistration({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  hostAccommodationId,
  reservationId = null,
  guestVehicleProfileId = null,
  idempotencyKey,
  input = {},
  sourceChannel = "staff",
}) {
  await assertVehicleRegister(actorUserId, campgroundId);

  const value = normalizeRoadVehicleRegistrationInput(input);
  const channel = normalizeRoadVehicleSourceChannel(sourceChannel);
  const key = normalizeIdempotencyKey(idempotencyKey);
  const hostId = requiredId(hostAccommodationId, "Host accommodation");
  const linkedReservationId = optionalId(reservationId);
  const savedVehicleId = optionalId(guestVehicleProfileId);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);

    const existing = await client.query(
      `select r.*, 'active'::text effective_status
       from public.road_vehicle_registrations r
       where r.campground_id=$1 and r.idempotency_key=$2
       limit 1`,
      [campgroundId, key],
    );
    if (existing.rowCount === 1) {
      await client.query("commit");
      return {
        registration: mapRegistration(existing.rows[0]),
        idempotent: true,
      };
    }

    const campgroundResult = await client.query(
      `select organization_id,display_name,time_zone
       from public.campgrounds
       where id=$1
       limit 1`,
      [campgroundId],
    );
    if (campgroundResult.rowCount !== 1) {
      throw new Error("Campground was not found.");
    }
    const campground = campgroundResult.rows[0];

    const hostResult = await client.query(
      `select id,code,display_name,lifecycle_state
       from public.accommodations
       where campground_id=$1 and id=$2
       limit 1`,
      [campgroundId, hostId],
    );
    if (
      hostResult.rowCount !== 1 ||
      hostResult.rows[0].lifecycle_state !== "active"
    ) {
      throw new Error("Host accommodation is not active in this campground.");
    }
    const host = hostResult.rows[0];

    let guestProfileId = null;
    let reservation = null;

    if (linkedReservationId) {
      const reservationResult = await client.query(
        `select id,accommodation_id,guest_profile_id,arrival_date,departure_date,status
         from public.reservations
         where campground_id=$1
           and id=$2
           and status in ('pending','confirmed','checked_in')
         limit 1`,
        [campgroundId, linkedReservationId],
      );
      if (reservationResult.rowCount !== 1) {
        throw new Error("Linked reservation is not active in this campground.");
      }
      reservation = reservationResult.rows[0];
      if (reservation.accommodation_id !== hostId) {
        throw new Error(
          "Host accommodation must match the linked reservation.",
        );
      }

      const arrivalDate = isoDate(reservation.arrival_date);
      const departureDate = isoDate(reservation.departure_date);
      if (value.validFrom < arrivalDate || value.validUntil > departureDate) {
        throw new Error(
          "A stay-linked vehicle registration must remain within the reservation dates.",
        );
      }
      guestProfileId = reservation.guest_profile_id ?? null;
    }

    if (savedVehicleId) {
      const savedVehicleResult = await client.query(
        `select id,guest_profile_id,vehicle_kind,profile_state
         from public.guest_vehicle_profiles
         where campground_id=$1 and id=$2
         limit 1`,
        [campgroundId, savedVehicleId],
      );
      if (
        savedVehicleResult.rowCount !== 1 ||
        savedVehicleResult.rows[0].profile_state !== "active"
      ) {
        throw new Error(
          "Saved vehicle profile is not active in this campground.",
        );
      }

      const savedVehicle = savedVehicleResult.rows[0];
      if (savedVehicle.vehicle_kind !== value.vehicleKind) {
        throw new Error("Vehicle kind must match the selected saved vehicle.");
      }
      if (guestProfileId && guestProfileId !== savedVehicle.guest_profile_id) {
        throw new Error(
          "Saved vehicle does not belong to the linked reservation guest.",
        );
      }
      guestProfileId = savedVehicle.guest_profile_id;
    }

    const plateLockKey =
      campgroundId + ":" + value.plateJurisdiction + ":" + value.plateNumber;
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      plateLockKey,
    ]);

    const overlap = await client.query(
      `select id
       from public.road_vehicle_registrations
       where campground_id=$1
         and plate_jurisdiction=$2
         and plate_number=$3
         and registration_status='active'
         and not (valid_until < $4::date or valid_from > $5::date)
       limit 1`,
      [
        campgroundId,
        value.plateJurisdiction,
        value.plateNumber,
        value.validFrom,
        value.validUntil,
      ],
    );
    if (overlap.rowCount > 0) {
      throw new Error(
        "This plate already has an overlapping active registration at this campground.",
      );
    }

    const inserted = await client.query(
      `insert into public.road_vehicle_registrations (
         organization_id,campground_id,reservation_id,guest_profile_id,
         guest_vehicle_profile_id,host_accommodation_id,host_accommodation_label,
         vehicle_kind,plate_number,plate_jurisdiction,vehicle_description,
         registered_owner_name,primary_driver_name,valid_from,valid_until,
         registration_status,source_channel,notes,idempotency_key,
         created_by_user_id,updated_by_user_id
       )
       values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
         'active',$16,$17,$18,$19,$19
       )
       returning *, 'active'::text effective_status`,
      [
        campground.organization_id,
        campgroundId,
        linkedReservationId,
        guestProfileId,
        savedVehicleId,
        hostId,
        host.code + " · " + host.display_name,
        value.vehicleKind,
        value.plateNumber,
        value.plateJurisdiction,
        value.vehicleDescription,
        value.registeredOwnerName,
        value.primaryDriverName,
        value.validFrom,
        value.validUntil,
        channel,
        value.notes,
        key,
        actorUserId,
      ],
    );
    const row = inserted.rows[0];

    await insertLifecycleEvent(client, {
      row,
      actorUserId,
      eventKind: "registered",
      priorStatus: null,
      newStatus: "active",
      reason: null,
      sourceChannel: channel,
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "vehicle.road_registration.create",
      permissionKey: "vehicle.register",
      riskLevel: "standard",
      subjectType: "road_vehicle_registration",
      subjectId: row.id,
      beforeState: null,
      afterState: {
        id: row.id,
        reservationId: linkedReservationId,
        guestProfileId,
        guestVehicleProfileId: savedVehicleId,
        hostAccommodationId: hostId,
        vehicleKind: value.vehicleKind,
        plateJurisdiction: value.plateJurisdiction,
        plateNumber: value.plateNumber,
        validFrom: value.validFrom,
        validUntil: value.validUntil,
        status: "active",
      },
      metadata: {
        sourceChannel: channel,
        feeBoundary: "Build 054",
        accessCredentialBoundary: "Build 056/063",
      },
    });

    await client.query("commit");
    return { registration: mapRegistration(row), idempotent: false };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (error?.code === "23505") {
      throw new Error(
        "This vehicle registration was already submitted. Refresh the vehicle desk.",
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeRoadVehicleRegistration({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  registrationId,
  expectedRowVersion,
  reason,
  sourceChannel = "staff",
}) {
  await assertVehicleRegister(actorUserId, campgroundId);
  const registrationKey = requiredId(registrationId, "Vehicle registration");
  const revocationReason = normalizeRoadVehicleRevocationReason(reason);
  const channel = normalizeRoadVehicleSourceChannel(sourceChannel);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);

    const currentResult = await client.query(
      `select *
       from public.road_vehicle_registrations
       where campground_id=$1 and id=$2
       for update`,
      [campgroundId, registrationKey],
    );
    if (currentResult.rowCount !== 1) {
      throw new Error("Road vehicle registration was not found.");
    }

    const before = currentResult.rows[0];
    if (before.registration_status === "revoked") {
      await client.query("commit");
      return { registration: mapRegistration(before), idempotent: true };
    }

    const updated = await client.query(
      `update public.road_vehicle_registrations
       set registration_status='revoked',
           revoked_at=statement_timestamp(),
           revocation_reason=$3,
           updated_by_user_id=$4
       where campground_id=$1
         and id=$2
         and row_version=$5
       returning *, 'revoked'::text effective_status`,
      [
        campgroundId,
        registrationKey,
        revocationReason,
        actorUserId,
        Number(expectedRowVersion),
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Vehicle registration changed since this page loaded. Refresh and try again.",
      );
    }
    const row = updated.rows[0];

    await insertLifecycleEvent(client, {
      row,
      actorUserId,
      eventKind: "revoked",
      priorStatus: "active",
      newStatus: "revoked",
      reason: revocationReason,
      sourceChannel: channel,
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "vehicle.road_registration.revoke",
      permissionKey: "vehicle.register",
      riskLevel: "standard",
      subjectType: "road_vehicle_registration",
      subjectId: row.id,
      beforeState: {
        status: before.registration_status,
        validFrom: isoDate(before.valid_from),
        validUntil: isoDate(before.valid_until),
      },
      afterState: {
        status: "revoked",
        revokedAt: iso(row.revoked_at),
        reason: revocationReason,
      },
      metadata: { sourceChannel: channel },
    });

    await client.query("commit");
    return { registration: mapRegistration(row), idempotent: false };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
