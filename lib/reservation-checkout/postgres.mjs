import { randomUUID } from "node:crypto";

import pg from "pg";

import {
  assertCompatibleBookingChoice,
} from "../accommodation-compatibility/core.mjs";
import {
  defaultBookingRulePolicy,
  evaluateBookingDateRules,
} from "../booking-rules/core.mjs";
import {
  bookingChargePriceLabel,
  quoteBookingCharges,
} from "../booking-charges/core.mjs";
import {
  calculateSiteAreaSquareMeters,
  evaluateCapacityRules,
} from "../capacity-rules/core.mjs";
import { normalizeAvailabilityWindow } from "../live-availability/core.mjs";
import { quoteAccommodationStay } from "../pricing/core.mjs";
import {
  finalReservationQuote,
  normalizeReservationCheckoutInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for reservation checkout.");
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

export async function closeReservationCheckoutPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertGuestAccount(client, userId) {
  const result = await client.query(
    `select id, email_normalized
       from icamp_private.user_accounts
       where id = $1
         and account_type = 'guest'
         and account_state = 'active'
       limit 1`,
    [userId],
  );
  if (result.rowCount !== 1) {
    const error = new Error("ICAMP_CHECKOUT_GUEST_ACCOUNT_REQUIRED");
    error.code = "ICAMP_CHECKOUT_GUEST_ACCOUNT_REQUIRED";
    throw error;
  }
  return result.rows[0];
}

function normalizePolicy(row) {
  if (!row) return defaultBookingRulePolicy;
  return {
    checkInTime: String(row.check_in_time).slice(0, 5),
    checkOutTime: String(row.check_out_time).slice(0, 5),
    minimumBookingLeadDays: Number(row.minimum_booking_lead_days),
    maximumBookingLeadDays: Number(row.maximum_booking_lead_days),
    minimumStayNights: Number(row.minimum_stay_nights),
    maximumStayNights: Number(row.maximum_stay_nights),
    weekendIsoDays: (row.weekend_iso_days ?? [6, 7]).map(Number),
  };
}

function mapPeriod(row) {
  return {
    id: row.id,
    periodKind: row.period_kind,
    code: row.code,
    displayName: row.display_name,
    startsOn: String(row.starts_on).slice(0, 10),
    endsOn: String(row.ends_on).slice(0, 10),
    minimumStayNights:
      row.minimum_stay_nights === null
        ? null
        : Number(row.minimum_stay_nights),
    maximumStayNights:
      row.maximum_stay_nights === null
        ? null
        : Number(row.maximum_stay_nights),
    isActive: row.is_active,
  };
}

function mapPlan(row) {
  return {
    id: row.id,
    accommodationId: row.accommodation_id,
    accommodationKind: row.accommodation_kind,
    code: row.code,
    displayName: row.display_name,
    currencyCode: row.currency_code,
    nightlyCents: row.nightly_cents,
    weeklyCents: row.weekly_cents,
    monthlyCents: row.monthly_cents,
    seasonalCents: row.seasonal_cents,
    yearlyCents: row.yearly_cents,
    startsOn: String(row.starts_on).slice(0, 10),
    endsOn: String(row.ends_on).slice(0, 10),
    priority: row.priority,
    isActive: row.is_active,
  };
}

function mapRateRule(row) {
  return {
    ratePlanId: row.rate_plan_id,
    ruleKind: row.rule_kind,
    calendarPeriodId: row.calendar_period_id,
    code: row.code,
    displayName: row.display_name,
    startsOn: row.starts_on ? String(row.starts_on).slice(0, 10) : null,
    endsOn: row.ends_on ? String(row.ends_on).slice(0, 10) : null,
    adjustmentPercent: row.adjustment_percent,
    adjustmentCents: row.adjustment_cents,
    priority: row.priority,
    isActive: row.is_active,
  };
}

function mapCharge(row) {
  return {
    id: row.id,
    scopeKind: row.scope_kind,
    accommodationKind: row.accommodation_kind,
    accommodationId: row.accommodation_id,
    chargeKind: row.charge_kind,
    applicationMode: row.application_mode,
    code: row.code,
    displayName: row.display_name,
    description: row.description,
    currencyCode: row.currency_code,
    pricingBasis: row.pricing_basis,
    unitPriceCents: row.unit_price_cents,
    percentageBasisPoints: row.percentage_basis_points,
    unitLabel: row.unit_label,
    passDurationDays: row.pass_duration_days,
    minimumQuantity: Number(row.minimum_quantity),
    maximumQuantity: Number(row.maximum_quantity),
    taxCategoryCode: row.tax_category_code,
    feeCategoryCode: row.fee_category_code,
    isPublic: row.is_public,
    isActive: row.is_active,
  };
}

function mapCapacityRule(row) {
  return {
    id: row.id,
    scopeKind: row.scope_kind,
    sectionId: row.section_id,
    accommodationKind: row.accommodation_kind,
    accommodationId: row.accommodation_id,
    minimumSiteAreaSquareMeters:
      row.minimum_site_area_m2 === null
        ? null
        : Number(row.minimum_site_area_m2),
    maximumSiteAreaSquareMeters:
      row.maximum_site_area_m2 === null
        ? null
        : Number(row.maximum_site_area_m2),
    maxOccupants:
      row.max_occupants === null ? null : Number(row.max_occupants),
    maxVisitors: row.max_visitors === null ? null : Number(row.max_visitors),
    maxVehicles: row.max_vehicles === null ? null : Number(row.max_vehicles),
    isActive: row.is_active,
  };
}

function compatibilityAccommodation(row) {
  return {
    id: row.accommodation_id,
    accommodationKind: row.accommodation_kind,
    campsiteType: row.campsite_type,
    maxRvLengthMeters:
      row.max_rv_length_meters === null
        ? null
        : Number(row.max_rv_length_meters),
    maxRvWidthMeters:
      row.max_rv_width_meters === null
        ? null
        : Number(row.max_rv_width_meters),
    maxRvHeightMeters:
      row.max_rv_height_meters === null
        ? null
        : Number(row.max_rv_height_meters),
    electricalAmperage: Number(row.electrical_amperage ?? 0),
    waterService: row.water_service,
    wastewaterService: row.wastewater_service,
    wifiService: row.wifi_service,
    accessibleSite: row.accessible_site === true,
    petsAllowed:
      row.accommodation_kind === "campsite"
        ? row.campsite_pets_allowed === true
        : row.cottage_pets_allowed === true,
    maxPets: Number(
      row.accommodation_kind === "campsite"
        ? row.campsite_max_pets ?? 0
        : row.cottage_max_pets ?? 0,
    ),
    physicalMaxOccupancy:
      row.max_occupancy === null ? null : Number(row.max_occupancy),
    stepFreeAccess: row.step_free_access === true,
    accessibleWashroom: row.accessible_washroom === true,
    kitchenType: row.kitchen_type,
    washroomType: row.washroom_type,
    showerType: row.shower_type,
    hasRefrigerator: row.has_refrigerator === true,
  };
}

function capacityContext(row) {
  return {
    accommodationId: row.accommodation_id,
    accommodationKind: row.accommodation_kind,
    sectionId: row.section_id,
    siteAreaSquareMeters: calculateSiteAreaSquareMeters({
      siteLengthMeters: row.site_length_meters,
      siteWidthMeters: row.site_width_meters,
    }),
    physicalMaxOccupancy:
      row.max_occupancy === null ? null : Number(row.max_occupancy),
  };
}

function defaultLodgingKind(row) {
  if (row.accommodation_kind === "rental_cottage") return "cottage";
  return row.campsite_type === "rv" ? "rv" : "tent";
}

async function readHold(client, userId, holdId, forUpdate = false) {
  const result = await client.query(
    `select
       h.id as hold_id,
       h.organization_id,
       h.campground_id,
       h.accommodation_id,
       h.arrival_date,
       h.departure_date,
       h.hold_state,
       h.expires_at,
       h.hold_key,
       h.checkout_user_id,
       c.name as campground_name,
       c.slug as campground_slug,
       c.timezone,
       to_char(statement_timestamp() at time zone c.timezone, 'YYYY-MM-DD')
         as booking_date,
       a.code as accommodation_code,
       a.display_name as accommodation_name,
       a.accommodation_kind,
       a.status_state,
       a.section_id,
       cs.campsite_type,
       cs.electrical_amperage,
       cs.water_service,
       cs.wastewater_service,
       cs.wifi_service,
       cs.site_length_meters,
       cs.site_width_meters,
       cs.max_rv_length_meters,
       cs.max_rv_width_meters,
       cs.max_rv_height_meters,
       cs.accessible_site,
       cs.pets_allowed as campsite_pets_allowed,
       cs.max_pets as campsite_max_pets,
       rc.max_occupancy,
       rc.step_free_access,
       rc.accessible_washroom,
       rc.kitchen_type,
       rc.washroom_type,
       rc.shower_type,
       rc.has_refrigerator,
       rc.pets_allowed as cottage_pets_allowed,
       rc.max_pets as cottage_max_pets
     from public.reservation_holds h
     join public.campgrounds c on c.id = h.campground_id
     join public.accommodations a on a.id = h.accommodation_id
     left join public.campsites cs
       on cs.campground_id = h.campground_id
      and cs.accommodation_id = h.accommodation_id
     left join public.rental_cottages rc
       on rc.campground_id = h.campground_id
      and rc.accommodation_id = h.accommodation_id
     where h.id = $1
       and h.checkout_user_id = $2
     limit 1${forUpdate ? " for update of h" : ""}`,
    [holdId, userId],
  );
  return result.rows[0] ?? null;
}

async function loadReferenceData(client, row) {
  const arrivalDate = String(row.arrival_date).slice(0, 10);
  const departureDate = String(row.departure_date).slice(0, 10);

  const [
    bookingRulesResult,
    periodsResult,
    ratePlansResult,
    rateRulesResult,
    chargesResult,
    capacityRulesResult,
  ] = await Promise.all([
    client.query(
      `select *
       from public.campground_booking_rules
       where campground_id = $1
       limit 1`,
      [row.campground_id],
    ),
    client.query(
      `select *
       from public.booking_calendar_periods
       where campground_id = $1
         and is_active
       order by starts_on, code`,
      [row.campground_id],
    ),
    client.query(
      `select *
       from public.rate_plans
       where campground_id = $1
         and is_active
         and starts_on <= $4::date
         and ends_on >= $3::date
         and (
           accommodation_id = $2
           or (
             accommodation_id is null
             and accommodation_kind = $5
           )
         )
       order by (accommodation_id is not null) desc, priority, code`,
      [
        row.campground_id,
        row.accommodation_id,
        arrivalDate,
        departureDate,
        row.accommodation_kind,
      ],
    ),
    client.query(
      `select rr.*
       from public.rate_rules rr
       join public.rate_plans rp on rp.id = rr.rate_plan_id
       where rr.campground_id = $1
         and rr.is_active
         and rp.is_active
         and (
           rp.accommodation_id = $2
           or (
             rp.accommodation_id is null
             and rp.accommodation_kind = $3
           )
         )
       order by rr.priority, rr.code`,
      [row.campground_id, row.accommodation_id, row.accommodation_kind],
    ),
    client.query(
      `select *
       from public.booking_charge_catalog
       where campground_id = $1
         and is_active
         and is_public
         and (starts_on is null or starts_on <= $4::date)
         and (ends_on is null or ends_on >= $3::date)
         and (
           scope_kind = 'campground'
           or (
             scope_kind = 'accommodation_type'
             and accommodation_kind = $5
           )
           or (
             scope_kind = 'accommodation'
             and accommodation_id = $2
           )
         )
       order by application_mode, charge_kind, display_name, code`,
      [
        row.campground_id,
        row.accommodation_id,
        arrivalDate,
        departureDate,
        row.accommodation_kind,
      ],
    ),
    client.query(
      `select *
       from public.capacity_limit_rules
       where campground_id = $1
         and is_active
       order by scope_kind, created_at, id`,
      [row.campground_id],
    ),
  ]);

  const policy = normalizePolicy(bookingRulesResult.rows[0]);
  const periods = periodsResult.rows.map(mapPeriod);
  const plans = ratePlansResult.rows.map(mapPlan);
  const rateRules = rateRulesResult.rows.map(mapRateRule);
  const catalog = chargesResult.rows.map(mapCharge);
  const capacityRules = capacityRulesResult.rows.map(mapCapacityRule);

  const dateRules = evaluateBookingDateRules({
    policy,
    periods,
    arrivalDate,
    departureDate,
    bookingDate: row.booking_date,
  });

  const stayQuote = quoteAccommodationStay({
    plans,
    rules: rateRules,
    periods,
    weekendIsoDays: policy.weekendIsoDays,
    accommodationId: row.accommodation_id,
    accommodationKind: row.accommodation_kind,
    arrivalDate,
    departureDate,
  });

  const baselineCapacity = evaluateCapacityRules({
    rules: capacityRules,
    context: capacityContext(row),
    occupants: 1,
    visitors: 0,
    vehicles: 0,
  });

  return {
    arrivalDate,
    departureDate,
    dateRules,
    stayQuote,
    catalog,
    capacityRules,
    baselineCapacity,
  };
}

function publicContext(row, guest, reference) {
  const automaticCharges =
    reference.stayQuote.status === "quoted"
      ? quoteBookingCharges({
          catalog: reference.catalog,
          selections: [],
          accommodationId: row.accommodation_id,
          accommodationKind: row.accommodation_kind,
          nights: reference.dateRules.nights,
          staySubtotalCents: reference.stayQuote.totalCents,
          currencyCode: reference.stayQuote.currencyCode,
        })
      : null;

  return {
    hold: {
      id: row.hold_id,
      state: row.hold_state,
      expiresAt: row.expires_at,
    },
    campground: {
      id: row.campground_id,
      name: row.campground_name,
      slug: row.campground_slug,
    },
    accommodation: {
      id: row.accommodation_id,
      code: row.accommodation_code,
      displayName: row.accommodation_name,
      kind: row.accommodation_kind,
      campsiteType: row.campsite_type ?? null,
    },
    dates: {
      arrivalDate: reference.arrivalDate,
      departureDate: reference.departureDate,
      nights: reference.dateRules.nights,
    },
    guest: {
      email: guest.email_normalized,
    },
    dateRules: reference.dateRules,
    rateQuote: reference.stayQuote,
    capacity: reference.baselineCapacity,
    defaultLodgingKind: defaultLodgingKind(row),
    bookingCharges: {
      automaticTotalCents: automaticCharges?.automaticTotalCents ?? 0,
      items: reference.catalog.map((item) => ({
        id: item.id,
        code: item.code,
        displayName: item.displayName,
        description: item.description ?? null,
        chargeKind: item.chargeKind,
        applicationMode: item.applicationMode,
        priceLabel: bookingChargePriceLabel(
          item,
          reference.stayQuote.currencyCode ?? item.currencyCode,
        ),
        minimumQuantity: item.minimumQuantity,
        maximumQuantity: item.maximumQuantity,
      })),
    },
  };
}

export async function startReservationCheckout({
  userId,
  campgroundSlug,
  accommodationId,
  arrivalDate,
  departureDate,
}) {
  const dates = normalizeAvailabilityWindow({ arrivalDate, departureDate });
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await assertGuestAccount(client, userId);

    const target = await client.query(
      `select
       c.id as campground_id,
       c.organization_id,
       c.temporary_hold_minutes,
       a.id as accommodation_id,
       a.status_state
     from public.campgrounds c
     join public.accommodations a
       on a.campground_id = c.id
      and a.organization_id = c.organization_id
     where c.slug = $1
       and c.lifecycle_state = 'active'
       and a.id = $2
       and a.lifecycle_state = 'active'
       and a.accommodation_kind in ('campsite','rental_cottage')
     limit 1`,
      [String(campgroundSlug ?? "").trim(), accommodationId],
    );

    if (target.rowCount !== 1 || target.rows[0].status_state !== "available") {
      const error = new Error("ICAMP_CHECKOUT_ACCOMMODATION_UNAVAILABLE");
      error.code = "ICAMP_CHECKOUT_ACCOMMODATION_UNAVAILABLE";
      throw error;
    }

    const row = target.rows[0];
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-live-availability:" + row.accommodation_id],
    );

    await client.query(
      `update public.reservation_holds
       set hold_state = 'expired',
           updated_by_user_id = $1
       where campground_id = $2
         and checkout_user_id = $1
         and accommodation_id = $3
         and hold_state = 'active'
         and expires_at <= statement_timestamp()`,
      [userId, row.campground_id, row.accommodation_id],
    );

    const existing = await client.query(
      `select id, expires_at
       from public.reservation_holds
       where campground_id = $1
         and checkout_user_id = $2
         and accommodation_id = $3
         and arrival_date = $4
         and departure_date = $5
         and hold_state = 'active'
         and expires_at > statement_timestamp()
       limit 1
       for update`,
      [
        row.campground_id,
        userId,
        row.accommodation_id,
        dates.arrivalDate,
        dates.departureDate,
      ],
    );

    if (existing.rowCount === 1) {
      await client.query("commit");
      return {
        holdId: existing.rows[0].id,
        expiresAt: existing.rows[0].expires_at,
      };
    }

    const inserted = await client.query(
      `insert into public.reservation_holds (
         organization_id,
         campground_id,
         accommodation_id,
         arrival_date,
         departure_date,
         hold_state,
         expires_at,
         hold_key,
         checkout_user_id,
         created_by_user_id,
         updated_by_user_id
       )
       values (
         $1,$2,$3,$4,$5,'active',
         statement_timestamp() + make_interval(mins => $6),
         $7,$8,$8,$8
       )
       returning id, expires_at`,
      [
        row.organization_id,
        row.campground_id,
        row.accommodation_id,
        dates.arrivalDate,
        dates.departureDate,
        Number(row.temporary_hold_minutes),
        "checkout-" + randomUUID(),
        userId,
      ],
    );

    await client.query("commit");
    return {
      holdId: inserted.rows[0].id,
      expiresAt: inserted.rows[0].expires_at,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (/Accommodation conflicts with/u.test(String(error?.message ?? ""))) {
      error.code = "ICAMP_CHECKOUT_ACCOMMODATION_UNAVAILABLE";
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getReservationCheckout({ userId, holdId }) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const guest = await assertGuestAccount(client, userId);

    await client.query(
      `update public.reservation_holds
       set hold_state = 'expired',
           updated_by_user_id = $2
       where id = $1
         and checkout_user_id = $2
         and hold_state = 'active'
         and expires_at <= statement_timestamp()`,
      [holdId, userId],
    );

    const row = await readHold(client, userId, holdId);
    if (!row) {
      await client.query("commit");
      return null;
    }

    if (row.hold_state !== "active") {
      await client.query("commit");
      return {
        hold: {
          id: row.hold_id,
          state: row.hold_state,
          expiresAt: row.expires_at,
        },
        campground: {
          id: row.campground_id,
          name: row.campground_name,
          slug: row.campground_slug,
        },
        accommodation: {
          id: row.accommodation_id,
          code: row.accommodation_code,
          displayName: row.accommodation_name,
          kind: row.accommodation_kind,
          campsiteType: row.campsite_type ?? null,
        },
        guest: { email: guest.email_normalized },
      };
    }

    const reference = await loadReferenceData(client, row);
    const result = publicContext(row, guest, reference);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function finalizeReservationCheckout({
  userId,
  holdId,
  input,
}) {
  const normalized = normalizeReservationCheckoutInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await assertGuestAccount(client, userId);

    const row = await readHold(client, userId, holdId, true);
    if (!row) {
      const error = new Error("ICAMP_CHECKOUT_HOLD_NOT_FOUND");
      error.code = "ICAMP_CHECKOUT_HOLD_NOT_FOUND";
      throw error;
    }

    const existing = await client.query(
      `select
       r.id,
       d.currency_code,
       d.quoted_total_cents
     from public.reservations r
     join public.reservation_checkout_details d
       on d.reservation_id = r.id
     where r.originating_hold_id = $1
       and r.guest_user_id = $2
     limit 1`,
      [holdId, userId],
    );

    if (existing.rowCount === 1) {
      await client.query("commit");
      return {
        reservationId: existing.rows[0].id,
        currencyCode: existing.rows[0].currency_code,
        totalCents: Number(existing.rows[0].quoted_total_cents),
        idempotent: true,
      };
    }

    if (
      row.hold_state !== "active" ||
      new Date(row.expires_at).getTime() <= Date.now()
    ) {
      const error = new Error("ICAMP_CHECKOUT_HOLD_EXPIRED");
      error.code = "ICAMP_CHECKOUT_HOLD_EXPIRED";
      throw error;
    }

    if (row.status_state !== "available") {
      const error = new Error("ICAMP_CHECKOUT_ACCOMMODATION_UNAVAILABLE");
      error.code = "ICAMP_CHECKOUT_ACCOMMODATION_UNAVAILABLE";
      throw error;
    }

    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-live-availability:" + row.accommodation_id],
    );

    const reference = await loadReferenceData(client, row);
    if (!reference.dateRules.eligible) {
      const error = new Error(
        "ICAMP_CHECKOUT_DATE_RULES_REJECTED: " +
          reference.dateRules.issues.join(" "),
      );
      error.code = "ICAMP_CHECKOUT_DATE_RULES_REJECTED";
      throw error;
    }

    const capacity = evaluateCapacityRules({
      rules: reference.capacityRules,
      context: capacityContext(row),
      occupants: normalized.occupants,
      visitors: normalized.visitors,
      vehicles: normalized.vehicles,
    });

    if (!capacity.eligible) {
      const error = new Error(
        "ICAMP_CHECKOUT_CAPACITY_REJECTED: " + capacity.issues.join(" "),
      );
      error.code = "ICAMP_CHECKOUT_CAPACITY_REJECTED";
      throw error;
    }

    const compatibility = assertCompatibleBookingChoice({
      accommodation: compatibilityAccommodation(row),
      request: {
        lodgingKind: normalized.lodgingKind,
        occupants: normalized.occupants,
        pets: normalized.pets,
        rvLengthMeters: normalized.rvLengthMeters,
        rvWidthMeters: normalized.rvWidthMeters,
        rvHeightMeters: normalized.rvHeightMeters,
        electricalAmperage: normalized.electricalAmperage,
        needsWaterAtSite: normalized.needsWaterAtSite,
        needsWastewaterAtSite: normalized.needsWastewaterAtSite,
        needsWifi: normalized.needsWifi,
        needsStepFreeAccess: normalized.needsStepFreeAccess,
        needsAccessibleWashroom: normalized.needsAccessibleWashroom,
        requiredFeatures: [],
      },
      capacity,
    });

    const chargeQuote =
      reference.stayQuote.status === "quoted"
        ? quoteBookingCharges({
            catalog: reference.catalog,
            selections: normalized.selections,
            accommodationId: row.accommodation_id,
            accommodationKind: row.accommodation_kind,
            nights: reference.dateRules.nights,
            staySubtotalCents: reference.stayQuote.totalCents,
            currencyCode: reference.stayQuote.currencyCode,
          })
        : null;

    const finalQuote = finalReservationQuote({
      stayQuote: reference.stayQuote,
      chargeQuote,
    });

    await client.query(
      `update public.reservation_holds
       set hold_state = 'converted',
           updated_by_user_id = $2
       where id = $1
         and hold_state = 'active'`,
      [holdId, userId],
    );

    const reservation = await client.query(
      `insert into public.reservations (
         organization_id,
         campground_id,
         accommodation_id,
         arrival_date,
         departure_date,
         status,
         source_channel,
         guest_user_id,
         originating_hold_id,
         created_by_user_id,
         updated_by_user_id
       )
       values ($1,$2,$3,$4,$5,'pending','web',$6,$7,$6,$6)
       returning id`,
      [
        row.organization_id,
        row.campground_id,
        row.accommodation_id,
        reference.arrivalDate,
        reference.departureDate,
        userId,
        holdId,
      ],
    );

    const reservationId = reservation.rows[0].id;
    const compatibilityRequest = {
      lodgingKind: normalized.lodgingKind,
      occupants: normalized.occupants,
      pets: normalized.pets,
      rvLengthMeters: normalized.rvLengthMeters,
      rvWidthMeters: normalized.rvWidthMeters,
      rvHeightMeters: normalized.rvHeightMeters,
      electricalAmperage: normalized.electricalAmperage,
      needsWaterAtSite: normalized.needsWaterAtSite,
      needsWastewaterAtSite: normalized.needsWastewaterAtSite,
      needsWifi: normalized.needsWifi,
      needsStepFreeAccess: normalized.needsStepFreeAccess,
      needsAccessibleWashroom: normalized.needsAccessibleWashroom,
      result: compatibility,
      capacity,
    };

    await client.query(
      `insert into public.reservation_checkout_details (
         organization_id,
         campground_id,
         reservation_id,
         guest_user_id,
         primary_first_name,
         primary_last_name,
         contact_email,
         contact_phone,
         occupant_count,
         visitor_count,
         pet_count,
         vehicle_count,
         lodging_kind,
         compatibility_request,
         booking_rules_snapshot,
         pricing_snapshot,
         currency_code,
         stay_subtotal_cents,
         charge_total_cents,
         quoted_total_cents,
         rules_acknowledged_at
       )
       values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
         $14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19,$20,
         statement_timestamp()
       )`,
      [
        row.organization_id,
        row.campground_id,
        reservationId,
        userId,
        normalized.primaryFirstName,
        normalized.primaryLastName,
        normalized.contactEmail,
        normalized.contactPhone,
        normalized.occupants,
        normalized.visitors,
        normalized.pets,
        normalized.vehicles,
        normalized.lodgingKind,
        JSON.stringify(compatibilityRequest),
        JSON.stringify(reference.dateRules),
        JSON.stringify({
          stay: reference.stayQuote,
          charges: chargeQuote,
          total: finalQuote,
        }),
        finalQuote.currencyCode,
        finalQuote.staySubtotalCents,
        finalQuote.chargeTotalCents,
        finalQuote.totalCents,
      ],
    );

    for (const line of chargeQuote.lines) {
      await client.query(
        `insert into public.reservation_charge_lines (
           organization_id,
           campground_id,
           reservation_id,
           guest_user_id,
           charge_catalog_id,
           code,
           display_name,
           charge_kind,
           application_mode,
           quantity,
           line_total_cents,
           currency_code,
           tax_category_code,
           fee_category_code
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          row.organization_id,
          row.campground_id,
          reservationId,
          userId,
          line.id,
          line.code,
          line.displayName,
          line.chargeKind,
          line.applicationMode,
          line.quantity,
          line.lineTotalCents,
          line.currencyCode,
          line.taxCategoryCode,
          line.feeCategoryCode,
        ],
      );
    }

    await client.query("commit");
    return {
      reservationId,
      currencyCode: finalQuote.currencyCode,
      totalCents: finalQuote.totalCents,
      idempotent: false,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (/Accommodation conflicts with/u.test(String(error?.message ?? ""))) {
      error.code = "ICAMP_CHECKOUT_HOLD_REVALIDATION_FAILED";
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getPendingReservationCheckout({
  userId,
  reservationId,
}) {
  const result = await getPool().query(
    `select
       r.id,
       r.status,
       r.arrival_date,
       r.departure_date,
       a.code as accommodation_code,
       a.display_name as accommodation_name,
       c.name as campground_name,
       c.slug as campground_slug,
       d.primary_first_name,
       d.primary_last_name,
       d.contact_email,
       d.occupant_count,
       d.visitor_count,
       d.pet_count,
       d.vehicle_count,
       d.currency_code,
       d.stay_subtotal_cents,
       d.charge_total_cents,
       d.quoted_total_cents,
       d.rules_acknowledged_at
     from public.reservations r
     join public.reservation_checkout_details d
       on d.reservation_id = r.id
     join public.accommodations a on a.id = r.accommodation_id
     join public.campgrounds c on c.id = r.campground_id
     where r.id = $1
       and r.guest_user_id = $2
       and d.guest_user_id = $2
     limit 1`,
    [reservationId, userId],
  );

  if (result.rowCount !== 1) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    status: row.status,
    campground: {
      name: row.campground_name,
      slug: row.campground_slug,
    },
    accommodation: {
      code: row.accommodation_code,
      displayName: row.accommodation_name,
    },
    dates: {
      arrivalDate: String(row.arrival_date).slice(0, 10),
      departureDate: String(row.departure_date).slice(0, 10),
    },
    contact: {
      name: row.primary_first_name + " " + row.primary_last_name,
      email: row.contact_email,
    },
    party: {
      occupants: Number(row.occupant_count),
      visitors: Number(row.visitor_count),
      pets: Number(row.pet_count),
      vehicles: Number(row.vehicle_count),
    },
    quote: {
      currencyCode: row.currency_code,
      staySubtotalCents: Number(row.stay_subtotal_cents),
      chargeTotalCents: Number(row.charge_total_cents),
      totalCents: Number(row.quoted_total_cents),
    },
    rulesAcknowledgedAt: row.rules_acknowledged_at,
  };
}
