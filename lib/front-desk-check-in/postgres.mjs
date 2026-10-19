import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { provisionReservationCredential } from "../access-credential-lifecycle/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  calculateSiteAreaSquareMeters,
  evaluateCapacityRules,
} from "../capacity-rules/core.mjs";
import {
  normalizeCheckInSourceChannel,
  normalizeFrontDeskCheckInInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for front desk check-in.");
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

export async function closeFrontDeskCheckInPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function mayRead(userId, campgroundId) {
  const [reservationRead, reservationModify, paymentRead] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "reservation.read"),
    hasCampgroundPermission(userId, campgroundId, "reservation.modify"),
    hasCampgroundPermission(userId, campgroundId, "payment.read"),
  ]);
  return (reservationRead || reservationModify) && paymentRead;
}

async function assertRead(userId, campgroundId) {
  if (!(await mayRead(userId, campgroundId))) {
    throw new Error(
      "Reservation read/modify and payment.read permissions are required for front desk check-in.",
    );
  }
}

async function assertModify(userId, campgroundId) {
  const [reservationModify, paymentRead] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "reservation.modify"),
    hasCampgroundPermission(userId, campgroundId, "payment.read"),
  ]);
  if (!reservationModify || !paymentRead) {
    throw new Error(
      "reservation.modify and payment.read permissions are required for check-in.",
    );
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function isoDate(value) {
  return value == null ? null : String(value).slice(0, 10);
}

function mapCapacityRule(row) {
  return {
    id: row.id,
    scopeKind: row.scope_kind,
    sectionId: row.section_id,
    accommodationKind: row.accommodation_kind,
    accommodationId: row.accommodation_id,
    minimumSiteAreaSquareMeters:
      row.minimum_site_area_m2 == null
        ? null
        : Number(row.minimum_site_area_m2),
    maximumSiteAreaSquareMeters:
      row.maximum_site_area_m2 == null
        ? null
        : Number(row.maximum_site_area_m2),
    maxOccupants: row.max_occupants == null ? null : Number(row.max_occupants),
    maxVisitors: row.max_visitors == null ? null : Number(row.max_visitors),
    maxVehicles: row.max_vehicles == null ? null : Number(row.max_vehicles),
    isActive: row.is_active === true,
  };
}

function balanceShape(row) {
  const reservationTotalCents = Number(row.current_total_cents ?? 0);
  const scheduledPayableCents =
    row.total_payable_cents == null
      ? reservationTotalCents
      : Number(row.total_payable_cents);
  const expectedPayableCents = Math.max(
    reservationTotalCents,
    scheduledPayableCents,
  );
  const capturedCents = Number(row.captured_cents ?? 0);

  return {
    reservationTotalCents,
    expectedPayableCents,
    capturedCents,
    outstandingBalanceCents: Math.max(expectedPayableCents - capturedCents, 0),
    financialReviewRequired: row.financial_review_required === true,
    currencyCode: row.currency_code ?? "CAD",
  };
}

async function reservationRow(
  client,
  campgroundId,
  reservationId,
  lock = false,
) {
  let sql = `
    select
      r.id,
      r.organization_id,
      r.campground_id,
      r.accommodation_id,
      r.guest_profile_id,
      r.status,
      r.arrival_date,
      r.departure_date,
      r.row_version,
      c.name as campground_name,
      c.slug as campground_slug,
      c.timezone as campground_timezone,
      to_char(
        statement_timestamp() at time zone c.timezone,
        'YYYY-MM-DD'
      ) as campground_local_date,
      a.code as accommodation_code,
      a.display_name as accommodation_name,
      a.accommodation_kind,
      a.section_id,
      cs.site_length_meters,
      cs.site_width_meters,
      cs.pets_allowed as campsite_pets_allowed,
      cs.max_pets as campsite_max_pets,
      rc.max_occupancy,
      rc.pets_allowed as cottage_pets_allowed,
      rc.max_pets as cottage_max_pets,
      d.occupant_count as checkout_occupant_count,
      d.visitor_count as checkout_visitor_count,
      d.pet_count as checkout_pet_count,
      d.vehicle_count as checkout_vehicle_count,
      coalesce(
        m.guest_display_name,
        nullif(trim(concat(d.primary_first_name, ' ', d.primary_last_name)), ''),
        nullif(trim(concat(g.first_name, ' ', g.last_name)), ''),
        'Front desk guest'
      ) as guest_display_name,
      coalesce(m.current_total_cents, d.quoted_total_cents, 0)
        as current_total_cents,
      coalesce(m.currency_code, d.currency_code, 'CAD') as currency_code,
      coalesce(m.financial_review_required, false)
        as financial_review_required,
      ps.total_payable_cents,
      coalesce((
        select sum(p.amount_cents)
        from public.reservation_payments p
        where p.reservation_id = r.id
          and p.payment_state = 'captured'
      ), 0)::bigint as captured_cents,
      ci.id as check_in_id,
      ci.checked_in_at,
      ci.verified_occupant_count,
      ci.verified_visitor_count,
      ci.verified_pet_count,
      ci.verified_vehicle_count,
      ci.reservation_total_cents as check_in_reservation_total_cents,
      ci.expected_payable_cents as check_in_expected_payable_cents,
      ci.captured_cents as check_in_captured_cents,
      ci.outstanding_balance_cents as check_in_outstanding_balance_cents,
      ci.balance_override_used,
      ci.balance_override_reason,
      ci.rules_acknowledged_at,
      ci.saved_stay_snapshot,
      ci.credential_request_count,
      ci.credential_handoff_state,
      ci.notes as check_in_notes
    from public.reservations r
    join public.campgrounds c on c.id = r.campground_id
    join public.accommodations a on a.id = r.accommodation_id
    left join public.campsites cs
      on cs.campground_id = r.campground_id
     and cs.accommodation_id = r.accommodation_id
    left join public.rental_cottages rc
      on rc.campground_id = r.campground_id
     and rc.accommodation_id = r.accommodation_id
    left join public.reservation_checkout_details d
      on d.reservation_id = r.id
    left join public.reservation_management_state m
      on m.reservation_id = r.id
    left join public.reservation_payment_schedules ps
      on ps.reservation_id = r.id
    left join public.guest_profiles g
      on g.id = r.guest_profile_id
     and g.campground_id = r.campground_id
    left join public.reservation_check_ins ci
      on ci.reservation_id = r.id
    where r.id = $1
      and r.campground_id = $2
    limit 1
  `;
  if (lock) sql += " for update of r";

  const result = await client.query(sql, [reservationId, campgroundId]);
  return result.rows[0] ?? null;
}

function mappedCheckIn(row) {
  if (!row?.check_in_id) return null;

  return {
    id: row.check_in_id,
    checkedInAt: iso(row.checked_in_at),
    occupantCount: Number(row.verified_occupant_count),
    visitorCount: Number(row.verified_visitor_count),
    petCount: Number(row.verified_pet_count),
    vehicleCount: Number(row.verified_vehicle_count),
    reservationTotalCents: Number(row.check_in_reservation_total_cents),
    expectedPayableCents: Number(row.check_in_expected_payable_cents),
    capturedCents: Number(row.check_in_captured_cents),
    outstandingBalanceCents: Number(row.check_in_outstanding_balance_cents),
    balanceOverrideUsed: row.balance_override_used === true,
    balanceOverrideReason: row.balance_override_reason ?? null,
    rulesAcknowledgedAt: iso(row.rules_acknowledged_at),
    savedStaySnapshot: row.saved_stay_snapshot ?? {
      vehicles: [],
      pets: [],
    },
    credentialRequestCount: Number(row.credential_request_count ?? 0),
    credentialHandoffState: row.credential_handoff_state,
    notes: row.check_in_notes ?? null,
  };
}

async function savedStayOptions(client, row) {
  if (!row.guest_profile_id) {
    return { vehicles: [], pets: [] };
  }

  const [vehicles, pets] = await Promise.all([
    client.query(
      `
        select id, nickname, vehicle_kind, make, model, color, model_year
        from public.guest_vehicle_profiles
        where campground_id = $1
          and guest_profile_id = $2
          and profile_state = 'active'
        order by nickname
      `,
      [row.campground_id, row.guest_profile_id],
    ),
    client.query(
      `
        select id, name, species, breed, weight_kg
        from public.guest_pet_profiles
        where campground_id = $1
          and guest_profile_id = $2
          and profile_state = 'active'
        order by name
      `,
      [row.campground_id, row.guest_profile_id],
    ),
  ]);

  return {
    vehicles: vehicles.rows.map((item) => ({
      id: item.id,
      nickname: item.nickname,
      vehicleKind: item.vehicle_kind,
      make: item.make ?? null,
      model: item.model ?? null,
      color: item.color ?? null,
      modelYear: item.model_year == null ? null : Number(item.model_year),
    })),
    pets: pets.rows.map((item) => ({
      id: item.id,
      name: item.name,
      species: item.species,
      breed: item.breed ?? null,
      weightKg: item.weight_kg == null ? null : Number(item.weight_kg),
    })),
  };
}

async function activeCapacityRules(client, campgroundId) {
  const result = await client.query(
    `
      select *
      from public.capacity_limit_rules
      where campground_id = $1
        and is_active
      order by created_at, id
    `,
    [campgroundId],
  );
  return result.rows.map(mapCapacityRule);
}

async function arrivalRequests(client, checkInId) {
  if (!checkInId) return [];

  const result = await client.query(
    `
      select
        id,
        request_kind,
        request_code,
        display_name,
        quantity,
        fulfillment_state,
        notes,
        created_at
      from public.reservation_check_in_requests
      where check_in_id = $1
      order by created_at, id
    `,
    [checkInId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    requestKind: row.request_kind,
    requestCode: row.request_code,
    displayName: row.display_name,
    quantity: Number(row.quantity),
    fulfillmentState: row.fulfillment_state,
    notes: row.notes ?? null,
    createdAt: iso(row.created_at),
  }));
}

export async function listFrontDeskArrivals({ userId, campgroundId }) {
  await assertRead(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await beginRls(client, userId);
    const result = await client.query(
      `
        select
          r.id,
          r.status,
          r.arrival_date,
          r.departure_date,
          r.row_version,
          c.name as campground_name,
          c.timezone as campground_timezone,
          to_char(
            statement_timestamp() at time zone c.timezone,
            'YYYY-MM-DD'
          ) as campground_local_date,
          a.code as accommodation_code,
          a.display_name as accommodation_name,
          coalesce(
            m.guest_display_name,
            nullif(trim(concat(d.primary_first_name, ' ', d.primary_last_name)), ''),
            nullif(trim(concat(g.first_name, ' ', g.last_name)), ''),
            'Front desk guest'
          ) as guest_display_name,
          coalesce(m.current_total_cents, d.quoted_total_cents, 0)
            as current_total_cents,
          coalesce(m.currency_code, d.currency_code, 'CAD') as currency_code,
          coalesce(m.financial_review_required, false)
            as financial_review_required,
          ps.total_payable_cents,
          coalesce((
            select sum(p.amount_cents)
            from public.reservation_payments p
            where p.reservation_id = r.id
              and p.payment_state = 'captured'
          ), 0)::bigint as captured_cents,
          ci.id as check_in_id,
          ci.checked_in_at
        from public.reservations r
        join public.campgrounds c on c.id = r.campground_id
        join public.accommodations a on a.id = r.accommodation_id
        left join public.reservation_checkout_details d
          on d.reservation_id = r.id
        left join public.reservation_management_state m
          on m.reservation_id = r.id
        left join public.reservation_payment_schedules ps
          on ps.reservation_id = r.id
        left join public.guest_profiles g
          on g.id = r.guest_profile_id
         and g.campground_id = r.campground_id
        left join public.reservation_check_ins ci
          on ci.reservation_id = r.id
        where r.campground_id = $1
          and r.status in ('pending', 'confirmed', 'checked_in')
          and r.departure_date >=
            ((statement_timestamp() at time zone c.timezone)::date - 1)
          and r.arrival_date <=
            ((statement_timestamp() at time zone c.timezone)::date + 14)
        order by
          case when r.status = 'checked_in' then 1 else 0 end,
          abs(
            r.arrival_date -
            (statement_timestamp() at time zone c.timezone)::date
          ),
          r.arrival_date,
          a.code
        limit 200
      `,
      [campgroundId],
    );

    await client.query("commit");

    return result.rows.map((row) => ({
      id: row.id,
      status: row.status,
      arrivalDate: isoDate(row.arrival_date),
      departureDate: isoDate(row.departure_date),
      rowVersion: Number(row.row_version),
      campgroundName: row.campground_name,
      campgroundLocalDate: row.campground_local_date,
      accommodationCode: row.accommodation_code,
      accommodationName: row.accommodation_name,
      guestDisplayName: row.guest_display_name,
      ...balanceShape(row),
      checkedIn: Boolean(row.check_in_id),
      checkedInAt: iso(row.checked_in_at),
    }));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getFrontDeskCheckInDetail({
  userId,
  campgroundId,
  reservationId,
}) {
  await assertRead(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await beginRls(client, userId);
    const row = await reservationRow(client, campgroundId, reservationId);
    if (!row) {
      await client.query("commit");
      return null;
    }

    const [saved, rules, requests] = await Promise.all([
      savedStayOptions(client, row),
      activeCapacityRules(client, campgroundId),
      arrivalRequests(client, row.check_in_id),
    ]);

    const capacity = evaluateCapacityRules({
      rules,
      context: {
        accommodationId: row.accommodation_id,
        accommodationKind: row.accommodation_kind,
        sectionId: row.section_id,
        siteAreaSquareMeters: calculateSiteAreaSquareMeters({
          siteLengthMeters: row.site_length_meters,
          siteWidthMeters: row.site_width_meters,
        }),
        physicalMaxOccupancy:
          row.max_occupancy == null ? null : Number(row.max_occupancy),
      },
      occupants: Number(row.checkout_occupant_count ?? 1),
      visitors: Number(row.checkout_visitor_count ?? 0),
      vehicles: Number(row.checkout_vehicle_count ?? 0),
    });

    const canOverride = await hasCampgroundPermission(
      userId,
      campgroundId,
      "reservation.override",
    );

    await client.query("commit");

    const petsAllowed =
      row.accommodation_kind === "campsite"
        ? row.campsite_pets_allowed === true
        : row.cottage_pets_allowed === true;
    const maxPets = Number(
      row.accommodation_kind === "campsite"
        ? (row.campsite_max_pets ?? 0)
        : (row.cottage_max_pets ?? 0),
    );

    return {
      reservation: {
        id: row.id,
        status: row.status,
        arrivalDate: isoDate(row.arrival_date),
        departureDate: isoDate(row.departure_date),
        rowVersion: Number(row.row_version),
        campgroundName: row.campground_name,
        campgroundLocalDate: row.campground_local_date,
        accommodationId: row.accommodation_id,
        accommodationCode: row.accommodation_code,
        accommodationName: row.accommodation_name,
        accommodationKind: row.accommodation_kind,
        guestProfileId: row.guest_profile_id ?? null,
        guestDisplayName: row.guest_display_name,
        checkoutCounts: {
          occupants: Number(row.checkout_occupant_count ?? 1),
          visitors: Number(row.checkout_visitor_count ?? 0),
          pets: Number(row.checkout_pet_count ?? 0),
          vehicles: Number(row.checkout_vehicle_count ?? 0),
        },
        petsAllowed,
        maxPets,
        ...balanceShape(row),
      },
      capacity,
      saved,
      checkIn: mappedCheckIn(row),
      arrivalRequests: requests,
      canOverride,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function selectedSavedSnapshot(client, row, normalized) {
  if (!row.guest_profile_id) {
    if (
      normalized.vehicleProfileIds.length > 0 ||
      normalized.petProfileIds.length > 0
    ) {
      throw new Error("Saved stay selections require a linked guest profile.");
    }
    return { vehicles: [], pets: [] };
  }

  if (normalized.vehicleProfileIds.length > normalized.vehicleCount) {
    throw new Error(
      "Selected saved vehicles cannot exceed the verified vehicle count.",
    );
  }
  if (normalized.petProfileIds.length > normalized.petCount) {
    throw new Error(
      "Selected saved pets cannot exceed the verified pet count.",
    );
  }

  const [vehicles, pets] = await Promise.all([
    normalized.vehicleProfileIds.length === 0
      ? Promise.resolve({ rows: [] })
      : client.query(
          `
            select id, nickname, vehicle_kind, make, model, color, model_year
            from public.guest_vehicle_profiles
            where campground_id = $1
              and guest_profile_id = $2
              and profile_state = 'active'
              and id = any($3::uuid[])
          `,
          [
            row.campground_id,
            row.guest_profile_id,
            normalized.vehicleProfileIds,
          ],
        ),
    normalized.petProfileIds.length === 0
      ? Promise.resolve({ rows: [] })
      : client.query(
          `
            select id, name, species, breed, weight_kg
            from public.guest_pet_profiles
            where campground_id = $1
              and guest_profile_id = $2
              and profile_state = 'active'
              and id = any($3::uuid[])
          `,
          [row.campground_id, row.guest_profile_id, normalized.petProfileIds],
        ),
  ]);

  if (vehicles.rows.length !== normalized.vehicleProfileIds.length) {
    throw new Error("One or more saved vehicle selections are unavailable.");
  }
  if (pets.rows.length !== normalized.petProfileIds.length) {
    throw new Error("One or more saved pet selections are unavailable.");
  }

  return {
    vehicles: vehicles.rows.map((item) => ({
      id: item.id,
      nickname: item.nickname,
      vehicleKind: item.vehicle_kind,
      make: item.make ?? null,
      model: item.model ?? null,
      color: item.color ?? null,
      modelYear: item.model_year == null ? null : Number(item.model_year),
    })),
    pets: pets.rows.map((item) => ({
      id: item.id,
      name: item.name,
      species: item.species,
      breed: item.breed ?? null,
      weightKg: item.weight_kg == null ? null : Number(item.weight_kg),
    })),
  };
}

async function insertArrivalRequest(
  client,
  {
    row,
    checkInId,
    actorUserId,
    requestKind,
    requestCode,
    displayName,
    quantity,
    notes = null,
  },
) {
  await client.query(
    `
      insert into public.reservation_check_in_requests (
        organization_id,
        campground_id,
        check_in_id,
        reservation_id,
        request_kind,
        request_code,
        display_name,
        quantity,
        notes,
        created_by_user_id
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
    [
      row.organization_id,
      row.campground_id,
      checkInId,
      row.id,
      requestKind,
      requestCode,
      displayName,
      quantity,
      notes,
      actorUserId,
    ],
  );
}

export async function checkInReservation({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  reservationId,
  expectedRowVersion,
  input,
  sourceChannel = "staff",
}) {
  await assertModify(actorUserId, campgroundId);
  const normalized = normalizeFrontDeskCheckInInput(input);
  const channel = normalizeCheckInSourceChannel(sourceChannel);
  const expected = Number(expectedRowVersion);

  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Reservation row version is invalid.");
  }

  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-front-desk-check-in:" + reservationId],
    );

    const row = await reservationRow(client, campgroundId, reservationId, true);
    if (!row) throw new Error("Reservation was not found.");

    if (row.check_in_id) {
      await client.query("commit");
      return {
        reservationId,
        checkInId: row.check_in_id,
        idempotent: true,
        checkedInAt: iso(row.checked_in_at),
        outstandingBalanceCents: Number(
          row.check_in_outstanding_balance_cents ?? 0,
        ),
        balanceOverrideUsed: row.balance_override_used === true,
      };
    }

    if (!["pending", "confirmed"].includes(row.status)) {
      throw new Error("Only pending or confirmed reservations can check in.");
    }

    if (Number(row.row_version) !== expected) {
      throw new Error(
        "Reservation changed since this check-in page loaded. Refresh and try again.",
      );
    }

    const today = row.campground_local_date;
    const arrivalDate = isoDate(row.arrival_date);
    const departureDate = isoDate(row.departure_date);

    if (today < arrivalDate) {
      throw new Error("Check-in cannot be completed before the arrival date.");
    }
    if (today >= departureDate) {
      throw new Error(
        "Check-in cannot be completed on or after the departure date.",
      );
    }

    const rules = await activeCapacityRules(client, campgroundId);
    const capacity = evaluateCapacityRules({
      rules,
      context: {
        accommodationId: row.accommodation_id,
        accommodationKind: row.accommodation_kind,
        sectionId: row.section_id,
        siteAreaSquareMeters: calculateSiteAreaSquareMeters({
          siteLengthMeters: row.site_length_meters,
          siteWidthMeters: row.site_width_meters,
        }),
        physicalMaxOccupancy:
          row.max_occupancy == null ? null : Number(row.max_occupancy),
      },
      occupants: normalized.occupantCount,
      visitors: normalized.visitorCount,
      vehicles: normalized.vehicleCount,
    });

    if (!capacity.eligible) {
      throw new Error(
        "Arrival counts violate capacity rules: " + capacity.issues.join(" "),
      );
    }

    const petsAllowed =
      row.accommodation_kind === "campsite"
        ? row.campsite_pets_allowed === true
        : row.cottage_pets_allowed === true;
    const maxPets = Number(
      row.accommodation_kind === "campsite"
        ? (row.campsite_max_pets ?? 0)
        : (row.cottage_max_pets ?? 0),
    );

    if (normalized.petCount > 0 && !petsAllowed) {
      throw new Error("Pets are not allowed for this accommodation.");
    }
    if (petsAllowed && normalized.petCount > maxPets) {
      throw new Error(
        "Pets exceed the accommodation maximum of " + maxPets + ".",
      );
    }

    const balance = balanceShape(row);
    const needsOverride =
      balance.outstandingBalanceCents > 0 ||
      balance.financialReviewRequired === true;

    let balanceOverrideUsed = false;
    let balanceOverrideReason = null;

    if (needsOverride) {
      if (!normalized.balanceOverrideRequested) {
        throw new Error(
          balance.financialReviewRequired
            ? "Financial review is still required before check-in. A reservation.override-authorized manager may explicitly override with a reason."
            : "Outstanding balance must be resolved before check-in. A reservation.override-authorized manager may explicitly override with a reason.",
        );
      }

      const canOverride = await hasCampgroundPermission(
        actorUserId,
        campgroundId,
        "reservation.override",
      );
      if (!canOverride) {
        throw new Error(
          "reservation.override permission is required to check in with an unresolved balance or financial review.",
        );
      }

      balanceOverrideUsed = true;
      balanceOverrideReason = normalized.balanceOverrideReason;
    }

    const savedStaySnapshot = await selectedSavedSnapshot(
      client,
      row,
      normalized,
    );

    const inserted = await client.query(
      `
        insert into public.reservation_check_ins (
          organization_id,
          campground_id,
          reservation_id,
          guest_profile_id,
          prior_reservation_status,
          verified_occupant_count,
          verified_visitor_count,
          verified_pet_count,
          verified_vehicle_count,
          reservation_total_cents,
          expected_payable_cents,
          captured_cents,
          outstanding_balance_cents,
          balance_override_used,
          balance_override_reason,
          rules_acknowledged_at,
          saved_stay_snapshot,
          credential_request_count,
          credential_handoff_state,
          source_channel,
          notes,
          checked_in_by_user_id
        )
        values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          statement_timestamp(),$16::jsonb,$17,$18,$19,$20,$21
        )
        returning id, checked_in_at
      `,
      [
        row.organization_id,
        row.campground_id,
        row.id,
        row.guest_profile_id,
        row.status,
        normalized.occupantCount,
        normalized.visitorCount,
        normalized.petCount,
        normalized.vehicleCount,
        balance.reservationTotalCents,
        balance.expectedPayableCents,
        balance.capturedCents,
        balance.outstandingBalanceCents,
        balanceOverrideUsed,
        balanceOverrideReason,
        JSON.stringify(savedStaySnapshot),
        normalized.credentialRequestCount,
        normalized.credentialRequestCount > 0 ? "requested" : "not_requested",
        channel,
        normalized.notes,
        actorUserId,
      ],
    );

    const checkInId = inserted.rows[0].id;
    const arrivalRequestItems = [
      ...normalized.rentalRequests,
      ...normalized.storeRequests,
    ];

    for (const request of arrivalRequestItems) {
      await insertArrivalRequest(client, {
        row,
        checkInId,
        actorUserId,
        ...request,
      });
    }

    if (normalized.credentialRequestCount > 0) {
      await insertArrivalRequest(client, {
        row,
        checkInId,
        actorUserId,
        requestKind: "access_credential",
        requestCode: "front-desk-access",
        displayName: "Access credential provisioning",
        quantity: normalized.credentialRequestCount,
        notes:
          "Provisioning is handled by the Build 062 reservation credential lifecycle after check-in.",
      });
    }

    const updated = await client.query(
      `
        update public.reservations
        set status = 'checked_in',
            updated_by_user_id = $3
        where id = $1
          and campground_id = $2
          and row_version = $4
          and status in ('pending','confirmed')
        returning row_version
      `,
      [reservationId, campgroundId, actorUserId, expected],
    );

    if (updated.rowCount !== 1) {
      throw new Error(
        "Reservation changed during check-in. Refresh and try again.",
      );
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "reservation.front_desk.check_in",
      permissionKey: "reservation.modify",
      riskLevel: balanceOverrideUsed ? "high" : "elevated",
      reason: balanceOverrideReason ?? "Front desk arrival check-in completed.",
      subjectType: "reservation",
      subjectId: reservationId,
      beforeState: {
        status: row.status,
        rowVersion: expected,
        outstandingBalanceCents: balance.outstandingBalanceCents,
        financialReviewRequired: balance.financialReviewRequired,
      },
      afterState: {
        status: "checked_in",
        occupantCount: normalized.occupantCount,
        visitorCount: normalized.visitorCount,
        petCount: normalized.petCount,
        vehicleCount: normalized.vehicleCount,
        rulesAcknowledged: true,
        credentialRequestCount: normalized.credentialRequestCount,
        arrivalRequestCount: arrivalRequestItems.length,
        balanceOverrideUsed,
      },
      metadata: {
        checkInId,
        sourceChannel: channel,
        build033CapacityRevalidated: true,
        build042BalanceVerified: true,
        build048SavedStaySnapshotUsed:
          savedStaySnapshot.vehicles.length > 0 ||
          savedStaySnapshot.pets.length > 0,
        vehicleRegistrationBoundary: "Build 053",
        visitorRegistrationBoundary: "Build 055",
        accessCredentialBoundary: "Build 056/061/062",
        rentalPosFulfillmentBoundary: "later rental/POS builds",
      },
    });

    await client.query("commit");

    return {
      reservationId,
      checkInId,
      idempotent: false,
      checkedInAt: iso(inserted.rows[0].checked_in_at),
      outstandingBalanceCents: balance.outstandingBalanceCents,
      balanceOverrideUsed,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}


export async function provisionCheckedInReservationCredential(input) {
  return provisionReservationCredential(input);
}
