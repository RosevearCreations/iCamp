import { randomUUID } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  bookingChargePriceLabel,
  quoteBookingCharges,
} from "../booking-charges/core.mjs";
import { quoteAccommodationStay } from "../pricing/core.mjs";
import {
  calculateReservationFinancialDelta,
  classifyReservationChange,
  normalizeManagementReason,
  normalizeReservationManagementInput,
  reservationManagementSnapshot,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for reservation management.");
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

export async function closeReservationManagementPoolForTests() {
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

async function hasAnyReservationPermission(userId, campgroundId) {
  const keys = [
    "reservation.read",
    "reservation.create",
    "reservation.modify",
    "reservation.cancel",
  ];
  const values = await Promise.all(
    keys.map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  return values.some(Boolean);
}

async function assertPermission(userId, campgroundId, permission) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permission))) {
    throw new Error("Not authorized for reservation management action.");
  }
}

function isoDate(value) {
  return String(value).slice(0, 10);
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
    startsOn: isoDate(row.starts_on),
    endsOn: isoDate(row.ends_on),
    priority: Number(row.priority),
    isActive: row.is_active,
  };
}

function mapRule(row) {
  return {
    ratePlanId: row.rate_plan_id,
    ruleKind: row.rule_kind,
    calendarPeriodId: row.calendar_period_id,
    code: row.code,
    displayName: row.display_name,
    startsOn: row.starts_on ? isoDate(row.starts_on) : null,
    endsOn: row.ends_on ? isoDate(row.ends_on) : null,
    adjustmentPercent: Number(row.adjustment_percent),
    adjustmentCents: Number(row.adjustment_cents),
    priority: Number(row.priority),
    isActive: row.is_active,
  };
}

function mapPeriod(row) {
  return {
    id: row.id,
    startsOn: isoDate(row.starts_on),
    endsOn: isoDate(row.ends_on),
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

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    `select id, organization_id, name, slug, timezone
     from public.campgrounds
     where id = $1
       and lifecycle_state = 'active'
     limit 1`,
    [campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Campground is unavailable.");
  }
  return result.rows[0];
}

async function accommodationScope(client, campgroundId, accommodationId) {
  const result = await client.query(
    `select id, organization_id, campground_id, code, display_name,
            accommodation_kind, lifecycle_state, status_state
     from public.accommodations
     where id = $1
       and campground_id = $2
       and lifecycle_state = 'active'
     limit 1`,
    [accommodationId, campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Accommodation is unavailable.");
  }
  return result.rows[0];
}

async function pricingReferences(
  client,
  campgroundId,
  accommodation,
  arrivalDate,
  departureDate,
) {
  const [rules, periods, plans, rateRules, charges] = await Promise.all([
    client.query(
      `select weekend_iso_days
       from public.campground_booking_rules
       where campground_id = $1
       limit 1`,
      [campgroundId],
    ),
    client.query(
      `select id, starts_on, ends_on, is_active
       from public.booking_calendar_periods
       where campground_id = $1
         and is_active
       order by starts_on`,
      [campgroundId],
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
        campgroundId,
        accommodation.id,
        arrivalDate,
        departureDate,
        accommodation.accommodation_kind,
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
      [
        campgroundId,
        accommodation.id,
        accommodation.accommodation_kind,
      ],
    ),
    client.query(
      `select *
       from public.booking_charge_catalog
       where campground_id = $1
         and is_active
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
        campgroundId,
        accommodation.id,
        arrivalDate,
        departureDate,
        accommodation.accommodation_kind,
      ],
    ),
  ]);

  return {
    weekendIsoDays: (rules.rows[0]?.weekend_iso_days ?? [6, 7]).map(Number),
    periods: periods.rows.map(mapPeriod),
    plans: plans.rows.map(mapPlan),
    rateRules: rateRules.rows.map(mapRule),
    charges: charges.rows.map(mapCharge),
  };
}

async function quoteManagedReservation(
  client,
  campgroundId,
  accommodation,
  arrivalDate,
  departureDate,
  selections,
) {
  const refs = await pricingReferences(
    client,
    campgroundId,
    accommodation,
    arrivalDate,
    departureDate,
  );
  const stay = quoteAccommodationStay({
    plans: refs.plans,
    rules: refs.rateRules,
    periods: refs.periods,
    weekendIsoDays: refs.weekendIsoDays,
    accommodationId: accommodation.id,
    accommodationKind: accommodation.accommodation_kind,
    arrivalDate,
    departureDate,
  });
  if (stay.status !== "quoted" || stay.totalCents == null || !stay.currencyCode) {
    throw new Error("A current rate is required for the managed reservation.");
  }

  const chargeQuote = quoteBookingCharges({
    catalog: refs.charges,
    selections,
    accommodationId: accommodation.id,
    accommodationKind: accommodation.accommodation_kind,
    nights: stay.nights,
    staySubtotalCents: stay.totalCents,
    currencyCode: stay.currencyCode,
  });

  return {
    currencyCode: stay.currencyCode,
    staySubtotalCents: stay.totalCents,
    chargeTotalCents: chargeQuote.totalCents,
    currentTotalCents: stay.totalCents + chargeQuote.totalCents,
    selections,
    lines: chargeQuote.lines,
    catalog: refs.charges.map((item) => ({
      ...item,
      priceLabel: bookingChargePriceLabel(item, stay.currencyCode),
    })),
  };
}

async function reservationRow(client, campgroundId, reservationId, lock = false) {
  const result = await client.query(
    `select
       r.id,
       r.organization_id,
       r.campground_id,
       r.accommodation_id,
       r.arrival_date,
       r.departure_date,
       r.status,
       r.source_channel,
       r.guest_user_id,
       r.row_version,
       a.code as accommodation_code,
       a.display_name as accommodation_name,
       a.accommodation_kind,
       c.name as campground_name,
       c.slug as campground_slug,
       d.primary_first_name,
       d.primary_last_name,
       d.contact_email as checkout_email,
       d.currency_code as checkout_currency,
       d.stay_subtotal_cents as checkout_stay_subtotal_cents,
       d.charge_total_cents as checkout_charge_total_cents,
       d.quoted_total_cents as checkout_total_cents,
       m.id as management_state_id,
       m.guest_display_name as management_guest_display_name,
       m.contact_email as management_contact_email,
       m.currency_code as management_currency,
       m.stay_subtotal_cents as management_stay_subtotal_cents,
       m.charge_total_cents as management_charge_total_cents,
       m.current_total_cents as management_total_cents,
       m.charge_selections as management_charge_selections,
       m.financial_review_required,
       m.financial_review_reason,
       m.row_version as management_row_version,
       exists (
         select 1
         from public.reservation_payment_schedules ps
         where ps.reservation_id = r.id
       ) as has_payment_schedule,
       coalesce((
         select sum(p.amount_cents)
         from public.reservation_payments p
         where p.reservation_id = r.id
           and p.payment_state = 'captured'
       ), 0)::bigint as captured_cents
     from public.reservations r
     join public.accommodations a on a.id = r.accommodation_id
     join public.campgrounds c on c.id = r.campground_id
     left join public.reservation_checkout_details d
       on d.reservation_id = r.id
     left join public.reservation_management_state m
       on m.reservation_id = r.id
     where r.id = $1
       and r.campground_id = $2
     limit 1
     ${lock ? "for update of r" : ""}`,
    [reservationId, campgroundId],
  );
  return result.rows[0] ?? null;
}

async function fallbackSelections(client, reservationId) {
  const result = await client.query(
    `select code, quantity
     from public.reservation_charge_lines
     where reservation_id = $1
       and application_mode = 'optional'
     order by code`,
    [reservationId],
  );
  return result.rows.map((row) => ({
    code: row.code,
    quantity: Number(row.quantity),
  }));
}

async function currentState(client, row) {
  if (row.management_state_id) {
    return {
      id: row.management_state_id,
      rowVersion: Number(row.management_row_version),
      guestDisplayName: row.management_guest_display_name,
      contactEmail: row.management_contact_email,
      currencyCode: row.management_currency,
      staySubtotalCents: Number(row.management_stay_subtotal_cents),
      chargeTotalCents: Number(row.management_charge_total_cents),
      currentTotalCents: Number(row.management_total_cents),
      chargeSelections: row.management_charge_selections ?? [],
      financialReviewRequired: row.financial_review_required === true,
      financialReviewReason: row.financial_review_reason,
      sourceQuoteKind: "managed_revision",
    };
  }

  if (row.checkout_total_cents != null) {
    return {
      id: null,
      rowVersion: 0,
      guestDisplayName:
        [row.primary_first_name, row.primary_last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || "Guest reservation",
      contactEmail: row.checkout_email,
      currencyCode: row.checkout_currency,
      staySubtotalCents: Number(row.checkout_stay_subtotal_cents),
      chargeTotalCents: Number(row.checkout_charge_total_cents),
      currentTotalCents: Number(row.checkout_total_cents),
      chargeSelections: await fallbackSelections(client, row.id),
      financialReviewRequired: false,
      financialReviewReason: null,
      sourceQuoteKind: "build041_checkout",
    };
  }

  throw new Error("Reservation management state is unavailable.");
}

function reservationSnapshotShape(row, state, override = {}) {
  return reservationManagementSnapshot({
    reservation: {
      id: row.id,
      status: override.status ?? row.status,
      accommodationId: override.accommodationId ?? row.accommodation_id,
      accommodationCode: override.accommodationCode ?? row.accommodation_code,
      accommodationName:
        override.accommodationName ?? row.accommodation_name,
      arrivalDate: override.arrivalDate ?? isoDate(row.arrival_date),
      departureDate: override.departureDate ?? isoDate(row.departure_date),
    },
    guestDisplayName: override.guestDisplayName ?? state.guestDisplayName,
    contactEmail:
      override.contactEmail !== undefined
        ? override.contactEmail
        : state.contactEmail,
    currencyCode: override.currencyCode ?? state.currencyCode,
    staySubtotalCents:
      override.staySubtotalCents ?? state.staySubtotalCents,
    chargeTotalCents: override.chargeTotalCents ?? state.chargeTotalCents,
    chargeSelections:
      override.chargeSelections ?? state.chargeSelections ?? [],
    financialReviewRequired:
      override.financialReviewRequired ?? state.financialReviewRequired,
    financialReviewReason:
      override.financialReviewReason !== undefined
        ? override.financialReviewReason
        : state.financialReviewReason,
  });
}

async function nextSequence(client, reservationId) {
  const result = await client.query(
    `select coalesce(max(sequence_no), 0)::integer + 1 as next_sequence
     from public.reservation_change_history
     where reservation_id = $1`,
    [reservationId],
  );
  return Number(result.rows[0].next_sequence);
}

async function insertHistory(client, {
  row,
  actorUserId,
  changeKind,
  reason,
  beforeSnapshot,
  afterSnapshot,
  financial,
  idempotencyKey,
  sourceChannel = "web",
}) {
  const sequence = await nextSequence(client, row.id);
  const inserted = await client.query(
    `insert into public.reservation_change_history (
       organization_id,
       campground_id,
       reservation_id,
       sequence_no,
       change_kind,
       source_channel,
       reason,
       before_snapshot,
       after_snapshot,
       currency_code,
       previous_total_cents,
       revised_total_cents,
       delta_cents,
       captured_cents,
       financial_review_required,
       idempotency_key,
       actor_user_id
     )
     values (
       $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17
     )
     returning id, sequence_no, occurred_at`,
    [
      row.organization_id,
      row.campground_id,
      row.id,
      sequence,
      changeKind,
      sourceChannel,
      reason,
      beforeSnapshot == null ? null : JSON.stringify(beforeSnapshot),
      JSON.stringify(afterSnapshot),
      afterSnapshot.pricing.currencyCode,
      financial.previousTotalCents,
      financial.revisedTotalCents,
      financial.deltaCents,
      financial.capturedCents,
      financial.financialReviewRequired,
      idempotencyKey,
      actorUserId,
    ],
  );
  return inserted.rows[0];
}

async function upsertState(client, {
  row,
  actorUserId,
  state,
  sourceQuoteKind,
}) {
  const result = await client.query(
    `insert into public.reservation_management_state (
       organization_id,
       campground_id,
       reservation_id,
       guest_display_name,
       contact_email,
       currency_code,
       stay_subtotal_cents,
       charge_total_cents,
       current_total_cents,
       charge_selections,
       source_quote_kind,
       financial_review_required,
       financial_review_reason,
       created_by_user_id,
       updated_by_user_id
     )
     values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$14
     )
     on conflict (reservation_id)
     do update set
       guest_display_name = excluded.guest_display_name,
       contact_email = excluded.contact_email,
       currency_code = excluded.currency_code,
       stay_subtotal_cents = excluded.stay_subtotal_cents,
       charge_total_cents = excluded.charge_total_cents,
       current_total_cents = excluded.current_total_cents,
       charge_selections = excluded.charge_selections,
       source_quote_kind = excluded.source_quote_kind,
       financial_review_required = excluded.financial_review_required,
       financial_review_reason = excluded.financial_review_reason,
       updated_by_user_id = excluded.updated_by_user_id
     returning *`,
    [
      row.organization_id,
      row.campground_id,
      row.id,
      state.guestDisplayName,
      state.contactEmail,
      state.currencyCode,
      state.staySubtotalCents,
      state.chargeTotalCents,
      state.currentTotalCents,
      JSON.stringify(state.chargeSelections ?? []),
      sourceQuoteKind,
      state.financialReviewRequired,
      state.financialReviewReason,
      actorUserId,
    ],
  );
  return result.rows[0];
}

async function existingIdempotentChange(client, campgroundId, idempotencyKey) {
  const result = await client.query(
    `select reservation_id, change_kind, sequence_no
     from public.reservation_change_history
     where campground_id = $1
       and idempotency_key = $2
     limit 1`,
    [campgroundId, idempotencyKey],
  );
  return result.rows[0] ?? null;
}

export async function listReservationManagementConsole({
  userId,
  campgroundId,
}) {
  if (!(await hasAnyReservationPermission(userId, campgroundId))) {
    throw new Error("Not authorized to read reservation management.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const campground = await campgroundScope(client, campgroundId);
    const [reservations, accommodations] = await Promise.all([
      client.query(
        `select
           r.id,
           r.status,
           r.arrival_date,
           r.departure_date,
           r.row_version,
           r.source_channel,
           a.code as accommodation_code,
           a.display_name as accommodation_name,
           coalesce(
             m.guest_display_name,
             nullif(trim(concat(d.primary_first_name, ' ', d.primary_last_name)), ''),
             'Staff reservation'
           ) as guest_display_name,
           coalesce(m.current_total_cents, d.quoted_total_cents, 0) as current_total_cents,
           coalesce(m.currency_code, d.currency_code, 'CAD') as currency_code,
           coalesce(m.financial_review_required, false) as financial_review_required,
           coalesce((
             select sum(p.amount_cents)
             from public.reservation_payments p
             where p.reservation_id = r.id
               and p.payment_state = 'captured'
           ), 0)::bigint as captured_cents
         from public.reservations r
         join public.accommodations a on a.id = r.accommodation_id
         left join public.reservation_checkout_details d
           on d.reservation_id = r.id
         left join public.reservation_management_state m
           on m.reservation_id = r.id
         where r.campground_id = $1
         order by
           case when r.status in ('pending','confirmed','checked_in') then 0 else 1 end,
           r.arrival_date,
           a.code
         limit 250`,
        [campgroundId],
      ),
      client.query(
        `select id, code, display_name, accommodation_kind, status_state
         from public.accommodations
         where campground_id = $1
           and lifecycle_state = 'active'
         order by code`,
        [campgroundId],
      ),
    ]);
    await client.query("commit");
    return {
      campground: {
        id: campground.id,
        name: campground.name,
        slug: campground.slug,
      },
      accommodations: accommodations.rows.map((row) => ({
        id: row.id,
        code: row.code,
        displayName: row.display_name,
        accommodationKind: row.accommodation_kind,
        statusState: row.status_state,
      })),
      reservations: reservations.rows.map((row) => ({
        id: row.id,
        status: row.status,
        arrivalDate: isoDate(row.arrival_date),
        departureDate: isoDate(row.departure_date),
        rowVersion: Number(row.row_version),
        sourceChannel: row.source_channel,
        accommodationCode: row.accommodation_code,
        accommodationName: row.accommodation_name,
        guestDisplayName: row.guest_display_name,
        currentTotalCents: Number(row.current_total_cents),
        currencyCode: row.currency_code,
        capturedCents: Number(row.captured_cents),
        financialReviewRequired: row.financial_review_required === true,
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getReservationManagementDetail({
  userId,
  campgroundId,
  reservationId,
}) {
  if (!(await hasAnyReservationPermission(userId, campgroundId))) {
    throw new Error("Not authorized to read reservation management.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const row = await reservationRow(client, campgroundId, reservationId);
    if (!row) {
      await client.query("commit");
      return null;
    }
    const state = await currentState(client, row);
    const [history, accommodations, refs] = await Promise.all([
      client.query(
        `select id, sequence_no, change_kind, source_channel, reason,
                before_snapshot, after_snapshot, currency_code,
                previous_total_cents, revised_total_cents, delta_cents,
                captured_cents, financial_review_required, occurred_at
         from public.reservation_change_history
         where reservation_id = $1
         order by sequence_no desc`,
        [reservationId],
      ),
      client.query(
        `select id, code, display_name, accommodation_kind, status_state
         from public.accommodations
         where campground_id = $1
           and lifecycle_state = 'active'
         order by code`,
        [campgroundId],
      ),
      pricingReferences(
        client,
        campgroundId,
        {
          id: row.accommodation_id,
          accommodation_kind: row.accommodation_kind,
        },
        isoDate(row.arrival_date),
        isoDate(row.departure_date),
      ),
    ]);

    await client.query("commit");
    return {
      reservation: {
        id: row.id,
        status: row.status,
        arrivalDate: isoDate(row.arrival_date),
        departureDate: isoDate(row.departure_date),
        rowVersion: Number(row.row_version),
        sourceChannel: row.source_channel,
        accommodationId: row.accommodation_id,
        accommodationCode: row.accommodation_code,
        accommodationName: row.accommodation_name,
        accommodationKind: row.accommodation_kind,
        campgroundName: row.campground_name,
        campgroundSlug: row.campground_slug,
        capturedCents: Number(row.captured_cents),
        hasPaymentSchedule: row.has_payment_schedule === true,
      },
      state,
      accommodations: accommodations.rows.map((item) => ({
        id: item.id,
        code: item.code,
        displayName: item.display_name,
        accommodationKind: item.accommodation_kind,
        statusState: item.status_state,
      })),
      chargeCatalog: refs.charges.map((item) => ({
        code: item.code,
        displayName: item.displayName,
        chargeKind: item.chargeKind,
        applicationMode: item.applicationMode,
        minimumQuantity: item.minimumQuantity,
        maximumQuantity: item.maximumQuantity,
        priceLabel: bookingChargePriceLabel(item, state.currencyCode),
      })),
      history: history.rows.map((item) => ({
        id: item.id,
        sequenceNo: Number(item.sequence_no),
        changeKind: item.change_kind,
        sourceChannel: item.source_channel,
        reason: item.reason,
        beforeSnapshot: item.before_snapshot,
        afterSnapshot: item.after_snapshot,
        currencyCode: item.currency_code,
        previousTotalCents: Number(item.previous_total_cents),
        revisedTotalCents: Number(item.revised_total_cents),
        deltaCents: Number(item.delta_cents),
        capturedCents: Number(item.captured_cents),
        financialReviewRequired: item.financial_review_required === true,
        occurredAt: new Date(item.occurred_at).toISOString(),
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createManagedReservation({
  actorUserId,
  campgroundId,
  input,
  reason,
  idempotencyKey = randomUUID(),
  sourceChannel = "web",
}) {
  await assertPermission(actorUserId, campgroundId, "reservation.create");
  const normalized = normalizeReservationManagementInput(input);
  const normalizedReason = normalizeManagementReason(reason);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    const prior = await existingIdempotentChange(
      client,
      campgroundId,
      idempotencyKey,
    );
    if (prior) {
      await client.query("commit");
      return { reservationId: prior.reservation_id, idempotent: true };
    }

    const campground = await campgroundScope(client, campgroundId);
    const accommodation = await accommodationScope(
      client,
      campgroundId,
      normalized.accommodationId,
    );
    const quote = await quoteManagedReservation(
      client,
      campgroundId,
      accommodation,
      normalized.arrivalDate,
      normalized.departureDate,
      normalized.selections,
    );

    const inserted = await client.query(
      `insert into public.reservations (
         organization_id,
         campground_id,
         accommodation_id,
         arrival_date,
         departure_date,
         status,
         source_channel,
         created_by_user_id,
         updated_by_user_id
       )
       values ($1,$2,$3,$4::date,$5::date,'pending','staff',$6,$6)
       returning *`,
      [
        campground.organization_id,
        campgroundId,
        accommodation.id,
        normalized.arrivalDate,
        normalized.departureDate,
        actorUserId,
      ],
    );
    const row = {
      ...inserted.rows[0],
      accommodation_code: accommodation.code,
      accommodation_name: accommodation.display_name,
    };
    const state = {
      guestDisplayName: normalized.guestDisplayName,
      contactEmail: normalized.contactEmail,
      currencyCode: quote.currencyCode,
      staySubtotalCents: quote.staySubtotalCents,
      chargeTotalCents: quote.chargeTotalCents,
      currentTotalCents: quote.currentTotalCents,
      chargeSelections: normalized.selections,
      financialReviewRequired: false,
      financialReviewReason: null,
    };
    const stateRow = await upsertState(client, {
      row,
      actorUserId,
      state,
      sourceQuoteKind: "staff_create",
    });
    const after = reservationSnapshotShape(row, state, {
      status: "pending",
      accommodationId: accommodation.id,
      accommodationCode: accommodation.code,
      accommodationName: accommodation.display_name,
      arrivalDate: normalized.arrivalDate,
      departureDate: normalized.departureDate,
    });
    const financial = calculateReservationFinancialDelta({
      previousTotalCents: 0,
      revisedTotalCents: quote.currentTotalCents,
      capturedCents: 0,
      hasPaymentSchedule: false,
    });
    await insertHistory(client, {
      row,
      actorUserId,
      changeKind: "create",
      reason: normalizedReason,
      beforeSnapshot: null,
      afterSnapshot: after,
      financial,
      idempotencyKey,
      sourceChannel,
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "reservation.management.create",
      permissionKey: "reservation.create",
      riskLevel: "elevated",
      reason: normalizedReason,
      subjectType: "reservation",
      subjectId: row.id,
      beforeState: null,
      afterState: {
        status: "pending",
        accommodationId: accommodation.id,
        arrivalDate: normalized.arrivalDate,
        departureDate: normalized.departureDate,
        currentTotalCents: quote.currentTotalCents,
        managementStateId: stateRow.id,
      },
      metadata: {
        paymentCaptured: false,
        refundExecuted: false,
      },
    });
    await client.query("commit");
    return { reservationId: row.id, idempotent: false };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateManagedReservation({
  actorUserId,
  campgroundId,
  reservationId,
  expectedRowVersion,
  input,
  reason,
  idempotencyKey = randomUUID(),
  sourceChannel = "web",
}) {
  await assertPermission(actorUserId, campgroundId, "reservation.modify");
  const normalized = normalizeReservationManagementInput(input);
  const normalizedReason = normalizeManagementReason(reason);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Reservation row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-reservation-management:" + reservationId],
    );

    const prior = await existingIdempotentChange(
      client,
      campgroundId,
      idempotencyKey,
    );
    if (prior) {
      await client.query("commit");
      return { reservationId, idempotent: true, changeKind: prior.change_kind };
    }

    const row = await reservationRow(client, campgroundId, reservationId, true);
    if (!row) throw new Error("Reservation was not found.");
    if (!["pending", "confirmed"].includes(row.status)) {
      throw new Error("Only pending or confirmed reservations can be edited.");
    }
    if (Number(row.row_version) !== expected) {
      throw new Error(
        "Reservation changed since this page loaded. Refresh and try again.",
      );
    }

    const state = await currentState(client, row);
    const target = await accommodationScope(
      client,
      campgroundId,
      normalized.accommodationId,
    );
    const quote = await quoteManagedReservation(
      client,
      campgroundId,
      target,
      normalized.arrivalDate,
      normalized.departureDate,
      normalized.selections,
    );

    if (quote.currencyCode !== state.currencyCode) {
      throw new Error(
        "Managed reservation currency cannot change during an edit.",
      );
    }

    const before = reservationSnapshotShape(row, state);
    const financial = calculateReservationFinancialDelta({
      previousTotalCents: state.currentTotalCents,
      revisedTotalCents: quote.currentTotalCents,
      capturedCents: Number(row.captured_cents),
      hasPaymentSchedule: row.has_payment_schedule === true,
    });
    const nextState = {
      guestDisplayName: normalized.guestDisplayName,
      contactEmail: normalized.contactEmail,
      currencyCode: quote.currencyCode,
      staySubtotalCents: quote.staySubtotalCents,
      chargeTotalCents: quote.chargeTotalCents,
      currentTotalCents: quote.currentTotalCents,
      chargeSelections: normalized.selections,
      financialReviewRequired: financial.financialReviewRequired,
      financialReviewReason: financial.financialReviewReason,
    };
    const after = reservationSnapshotShape(row, nextState, {
      accommodationId: target.id,
      accommodationCode: target.code,
      accommodationName: target.display_name,
      arrivalDate: normalized.arrivalDate,
      departureDate: normalized.departureDate,
    });
    const changeKind = classifyReservationChange(
      {
        status: row.status,
        accommodationId: row.accommodation_id,
        arrivalDate: isoDate(row.arrival_date),
        departureDate: isoDate(row.departure_date),
        currentTotalCents: state.currentTotalCents,
        chargeSelections: state.chargeSelections,
      },
      {
        status: row.status,
        accommodationId: target.id,
        arrivalDate: normalized.arrivalDate,
        departureDate: normalized.departureDate,
        currentTotalCents: quote.currentTotalCents,
        chargeSelections: normalized.selections,
      },
    );

    const updated = await client.query(
      `update public.reservations
       set accommodation_id = $3,
           arrival_date = $4::date,
           departure_date = $5::date,
           updated_by_user_id = $6
       where id = $1
         and campground_id = $2
         and row_version = $7
       returning *`,
      [
        reservationId,
        campgroundId,
        target.id,
        normalized.arrivalDate,
        normalized.departureDate,
        actorUserId,
        expected,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Reservation changed since this page loaded. Refresh and try again.",
      );
    }

    const updatedRow = {
      ...row,
      ...updated.rows[0],
      accommodation_code: target.code,
      accommodation_name: target.display_name,
    };
    await upsertState(client, {
      row: updatedRow,
      actorUserId,
      state: nextState,
      sourceQuoteKind: "managed_revision",
    });
    await insertHistory(client, {
      row: updatedRow,
      actorUserId,
      changeKind,
      reason: normalizedReason,
      beforeSnapshot: before,
      afterSnapshot: after,
      financial,
      idempotencyKey,
      sourceChannel,
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "reservation.management." + changeKind,
      permissionKey: "reservation.modify",
      riskLevel: financial.financialReviewRequired ? "high" : "elevated",
      reason: normalizedReason,
      subjectType: "reservation",
      subjectId: reservationId,
      beforeState: {
        accommodationId: row.accommodation_id,
        arrivalDate: isoDate(row.arrival_date),
        departureDate: isoDate(row.departure_date),
        currentTotalCents: state.currentTotalCents,
      },
      afterState: {
        accommodationId: target.id,
        arrivalDate: normalized.arrivalDate,
        departureDate: normalized.departureDate,
        currentTotalCents: quote.currentTotalCents,
      },
      metadata: {
        deltaCents: financial.deltaCents,
        financialReviewRequired: financial.financialReviewRequired,
        refundExecuted: false,
      },
    });
    await client.query("commit");
    return {
      reservationId,
      idempotent: false,
      changeKind,
      financialReviewRequired: financial.financialReviewRequired,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelManagedReservation({
  actorUserId,
  campgroundId,
  reservationId,
  expectedRowVersion,
  reason,
  idempotencyKey = randomUUID(),
  sourceChannel = "web",
}) {
  await assertPermission(actorUserId, campgroundId, "reservation.cancel");
  const normalizedReason = normalizeManagementReason(reason);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Reservation row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-reservation-management:" + reservationId],
    );

    const prior = await existingIdempotentChange(
      client,
      campgroundId,
      idempotencyKey,
    );
    if (prior) {
      await client.query("commit");
      return { reservationId, idempotent: true };
    }

    const row = await reservationRow(client, campgroundId, reservationId, true);
    if (!row) throw new Error("Reservation was not found.");
    if (row.status === "cancelled") {
      await client.query("commit");
      return { reservationId, idempotent: true };
    }
    if (!["pending", "confirmed"].includes(row.status)) {
      throw new Error("Only pending or confirmed reservations can be cancelled.");
    }
    if (Number(row.row_version) !== expected) {
      throw new Error(
        "Reservation changed since this page loaded. Refresh and try again.",
      );
    }

    const state = await currentState(client, row);
    const before = reservationSnapshotShape(row, state);
    const financial = calculateReservationFinancialDelta({
      previousTotalCents: state.currentTotalCents,
      revisedTotalCents: state.currentTotalCents,
      capturedCents: Number(row.captured_cents),
      hasPaymentSchedule: row.has_payment_schedule === true,
      cancelled: true,
    });
    const nextState = {
      ...state,
      financialReviewRequired: financial.financialReviewRequired,
      financialReviewReason: financial.financialReviewReason,
    };
    const after = reservationSnapshotShape(row, nextState, {
      status: "cancelled",
    });

    const updated = await client.query(
      `update public.reservations
       set status = 'cancelled',
           updated_by_user_id = $3
       where id = $1
         and campground_id = $2
         and row_version = $4
       returning *`,
      [reservationId, campgroundId, actorUserId, expected],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Reservation changed since this page loaded. Refresh and try again.",
      );
    }

    const updatedRow = { ...row, ...updated.rows[0] };
    await upsertState(client, {
      row: updatedRow,
      actorUserId,
      state: nextState,
      sourceQuoteKind: "managed_revision",
    });
    await insertHistory(client, {
      row: updatedRow,
      actorUserId,
      changeKind: "cancel",
      reason: normalizedReason,
      beforeSnapshot: before,
      afterSnapshot: after,
      financial,
      idempotencyKey,
      sourceChannel,
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "reservation.management.cancel",
      permissionKey: "reservation.cancel",
      riskLevel: financial.financialReviewRequired ? "high" : "elevated",
      reason: normalizedReason,
      subjectType: "reservation",
      subjectId: reservationId,
      beforeState: { status: row.status },
      afterState: { status: "cancelled" },
      metadata: {
        capturedCents: financial.capturedCents,
        financialReviewRequired: financial.financialReviewRequired,
        refundExecuted: false,
        refundBoundary: "Build 045",
      },
    });
    await client.query("commit");
    return {
      reservationId,
      idempotent: false,
      financialReviewRequired: financial.financialReviewRequired,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
