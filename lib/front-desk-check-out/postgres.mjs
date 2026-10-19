import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { revokeReservationCredentialsWithClient } from "../access-credential-lifecycle/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeCheckOutSourceChannel,
  normalizeReservationCheckOutInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for front desk checkout.");
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

export async function closeFrontDeskCheckOutPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertRead(userId, campgroundId) {
  const [reservationRead, reservationModify, paymentRead] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "reservation.read"),
    hasCampgroundPermission(userId, campgroundId, "reservation.modify"),
    hasCampgroundPermission(userId, campgroundId, "payment.read"),
  ]);
  if (!(reservationRead || reservationModify) || !paymentRead) {
    throw new Error(
      "Reservation read/modify and payment.read permissions are required for front desk checkout.",
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
      "reservation.modify and payment.read permissions are required for checkout.",
    );
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await setAppRole(client, userId);
}

async function setAppRole(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

async function resetAppRole(client) {
  await client.query("reset role");
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function isoDate(value) {
  return value == null ? null : String(value).slice(0, 10);
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
      a.accommodation_kind,
      a.status_state as accommodation_status_state,
      a.row_version as accommodation_row_version,
      coalesce(
        m.guest_display_name,
        nullif(trim(concat(d.primary_first_name, ' ', d.primary_last_name)), ''),
        nullif(trim(concat(g.first_name, ' ', g.last_name)), ''),
        'Front desk guest'
      ) as guest_display_name,
      coalesce(m.current_total_cents,d.quoted_total_cents,0)
        as current_total_cents,
      coalesce(m.currency_code,d.currency_code,'CAD') as currency_code,
      coalesce(m.financial_review_required,false)
        as financial_review_required,
      ps.total_payable_cents,
      coalesce((
        select sum(p.amount_cents)
        from public.reservation_payments p
        where p.reservation_id = r.id
          and p.payment_state = 'captured'
      ),0)::bigint as captured_cents,
      ci.id as check_in_id,
      ci.checked_in_at,
      ci.credential_request_count,
      coalesce((
        select sum(req.quantity)
        from public.reservation_check_in_requests req
        where req.check_in_id = ci.id
          and req.request_kind = 'rental'
      ),0)::integer as rental_request_count,
      co.id as check_out_id,
      co.checked_out_at,
      co.outstanding_balance_cents as check_out_outstanding_balance_cents,
      co.financial_handoff_state,
      co.rental_return_state,
      co.key_return_state,
      co.credential_return_state,
      co.return_notes,
      co.departure_notes,
      co.accommodation_status_before,
      co.accommodation_status_after,
      co.turnover_kind,
      co.turnover_state,
      co.cottage_turnover_id,
      co.cottage_turnover_template_id
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
    left join public.reservation_check_outs co
      on co.reservation_id = r.id
    where r.id = $1
      and r.campground_id = $2
    limit 1
  `;

  if (lock) sql += " for update of r, a";

  const result = await client.query(sql, [reservationId, campgroundId]);
  return result.rows[0] ?? null;
}

function mapCheckOut(row) {
  if (!row?.check_out_id) return null;
  return {
    id: row.check_out_id,
    checkedOutAt: iso(row.checked_out_at),
    outstandingBalanceCents: Number(
      row.check_out_outstanding_balance_cents ?? 0,
    ),
    financialHandoffState: row.financial_handoff_state,
    rentalReturnState: row.rental_return_state,
    keyReturnState: row.key_return_state,
    credentialReturnState: row.credential_return_state,
    returnNotes: row.return_notes ?? null,
    departureNotes: row.departure_notes ?? null,
    accommodationStatusBefore: row.accommodation_status_before,
    accommodationStatusAfter: row.accommodation_status_after,
    turnoverKind: row.turnover_kind,
    turnoverState: row.turnover_state,
    cottageTurnoverId: row.cottage_turnover_id ?? null,
    cottageTurnoverTemplateId: row.cottage_turnover_template_id ?? null,
  };
}

export async function listFrontDeskDepartures({ userId, campgroundId }) {
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
          to_char(
            statement_timestamp() at time zone c.timezone,
            'YYYY-MM-DD'
          ) as campground_local_date,
          a.code as accommodation_code,
          a.display_name as accommodation_name,
          a.accommodation_kind,
          a.status_state as accommodation_status_state,
          coalesce(
            m.guest_display_name,
            nullif(trim(concat(d.primary_first_name, ' ', d.primary_last_name)), ''),
            nullif(trim(concat(g.first_name, ' ', g.last_name)), ''),
            'Front desk guest'
          ) as guest_display_name,
          coalesce(m.current_total_cents,d.quoted_total_cents,0)
            as current_total_cents,
          coalesce(m.currency_code,d.currency_code,'CAD') as currency_code,
          coalesce(m.financial_review_required,false)
            as financial_review_required,
          ps.total_payable_cents,
          coalesce((
            select sum(p.amount_cents)
            from public.reservation_payments p
            where p.reservation_id = r.id
              and p.payment_state = 'captured'
          ),0)::bigint as captured_cents,
          ci.id as check_in_id,
          co.id as check_out_id,
          co.checked_out_at,
          co.turnover_state
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
        left join public.reservation_check_outs co
          on co.reservation_id = r.id
        where r.campground_id = $1
          and (
            r.status = 'checked_in'
            or (
              r.status = 'completed'
              and co.checked_out_at >= statement_timestamp() - interval '14 days'
            )
          )
        order by
          case when r.status='checked_in' then 0 else 1 end,
          r.departure_date,
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
      accommodationKind: row.accommodation_kind,
      accommodationStatusState: row.accommodation_status_state,
      guestDisplayName: row.guest_display_name,
      ...balanceShape(row),
      checkedIn: Boolean(row.check_in_id),
      checkedOut: Boolean(row.check_out_id),
      checkedOutAt: iso(row.checked_out_at),
      turnoverState: row.turnover_state ?? null,
    }));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getFrontDeskCheckOutDetail({
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

    const requests = row.check_in_id
      ? await client.query(
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
            order by created_at,id
          `,
          [row.check_in_id],
        )
      : { rows: [] };

    await client.query("commit");

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
        accommodationStatusState: row.accommodation_status_state,
        guestDisplayName: row.guest_display_name,
        ...balanceShape(row),
      },
      checkIn: row.check_in_id
        ? {
            id: row.check_in_id,
            checkedInAt: iso(row.checked_in_at),
            credentialRequestCount: Number(row.credential_request_count ?? 0),
            rentalRequestCount: Number(row.rental_request_count ?? 0),
          }
        : null,
      checkOut: mapCheckOut(row),
      arrivalRequests: requests.rows.map((request) => ({
        id: request.id,
        requestKind: request.request_kind,
        requestCode: request.request_code,
        displayName: request.display_name,
        quantity: Number(request.quantity),
        fulfillmentState: request.fulfillment_state,
        notes: request.notes ?? null,
        createdAt: iso(request.created_at),
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function transitionAccommodationStep(
  client,
  { accommodationId, campgroundId, actorUserId, toState, reason },
) {
  await client.query("select set_config('icamp.user_id', $1, true)", [
    actorUserId,
  ]);
  await client.query("select set_config('icamp.status_reason', $1, true)", [
    reason,
  ]);

  const result = await client.query(
    `
      update public.accommodations
      set status_state=$3,
          updated_by_user_id=$4
      where id=$1
        and campground_id=$2
      returning status_state,row_version,status_revision,availability_revision
    `,
    [accommodationId, campgroundId, toState, actorUserId],
  );

  if (result.rowCount !== 1) {
    throw new Error("Accommodation status could not be advanced.");
  }

  return result.rows[0];
}

async function moveAccommodationToPostDepartureState(client, row, actorUserId) {
  const before = row.accommodation_status_state;
  let current = before;
  const reason =
    "Build 050 checkout departure and post-departure inspection handoff.";

  if (["maintenance", "winterized", "closed", "inspection"].includes(current)) {
    return {
      before,
      after: current,
      protectedExistingState: ["maintenance", "winterized", "closed"].includes(
        current,
      ),
    };
  }

  const sequences = {
    occupied: ["departing", "inspection"],
    departing: ["inspection"],
    arriving: ["inspection"],
    reserved: ["arriving", "inspection"],
    available: ["inspection"],
    held: ["available", "inspection"],
  };
  const sequence = sequences[current];
  if (!sequence) {
    throw new Error(
      "Accommodation status cannot enter the post-departure inspection path.",
    );
  }

  for (const nextState of sequence) {
    const changed = await transitionAccommodationStep(client, {
      accommodationId: row.accommodation_id,
      campgroundId: row.campground_id,
      actorUserId,
      toState: nextState,
      reason,
    });
    current = changed.status_state;
  }

  return {
    before,
    after: current,
    protectedExistingState: false,
  };
}

async function existingCottageDepartureTurnover(client, row) {
  const result = await client.query(
    `
      select t.id,t.template_id
      from public.cottage_turnovers t
      join public.cottage_housekeeping_templates ht
        on ht.id=t.template_id
       and ht.organization_id=t.organization_id
       and ht.campground_id=t.campground_id
      where t.campground_id=$1
        and t.accommodation_id=$2
        and t.status in ('scheduled','in_progress','inspection','blocked')
        and ht.turnover_type='departure'
      order by t.created_at desc,t.id desc
      limit 1
    `,
    [row.campground_id, row.accommodation_id],
  );
  return result.rows[0] ?? null;
}

async function activeDepartureTemplates(client, row) {
  const result = await client.query(
    `
      select id
      from public.cottage_housekeeping_templates
      where campground_id=$1
        and accommodation_id=$2
        and turnover_type='departure'
        and is_active
      order by updated_at desc,id
      limit 2
    `,
    [row.campground_id, row.accommodation_id],
  );
  return result.rows;
}

async function createAutomaticCottageTurnover(
  client,
  row,
  actorUserId,
  templateId,
) {
  const inserted = await client.query(
    `
      insert into public.cottage_turnovers (
        organization_id,
        campground_id,
        accommodation_id,
        template_id,
        status,
        scheduled_for,
        assigned_user_id,
        notes,
        created_by_user_id,
        updated_by_user_id
      )
      values (
        $1,$2,$3,$4,'scheduled',statement_timestamp(),null,
        'Automatically triggered by Build 050 reservation checkout.',
        $5,$5
      )
      returning id,template_id
    `,
    [
      row.organization_id,
      row.campground_id,
      row.accommodation_id,
      templateId,
      actorUserId,
    ],
  );

  await client.query(
    `
      insert into public.cottage_turnover_item_checks (
        organization_id,
        campground_id,
        accommodation_id,
        turnover_id,
        checklist_item_id,
        item_category,
        item_name,
        required_quantity,
        unit,
        expected_condition,
        is_required,
        updated_by_user_id
      )
      select
        organization_id,
        campground_id,
        accommodation_id,
        $1,
        id,
        item_category,
        item_name,
        required_quantity,
        unit,
        expected_condition,
        is_required,
        $2
      from public.cottage_inventory_checklist_items
      where template_id=$3
        and campground_id=$4
        and is_active
      order by sort_order,item_name
    `,
    [inserted.rows[0].id, actorUserId, templateId, row.campground_id],
  );

  return inserted.rows[0];
}

async function resolveTurnoverHandoff(client, row, actorUserId, statusResult) {
  if (row.accommodation_kind !== "cottage") {
    return {
      turnoverKind: "post_departure_inspection",
      turnoverState: statusResult.protectedExistingState
        ? "protected_existing_state"
        : "inspection_required",
      cottageTurnoverId: null,
      cottageTurnoverTemplateId: null,
    };
  }

  const existing = await existingCottageDepartureTurnover(client, row);
  if (existing) {
    return {
      turnoverKind: "cottage_housekeeping",
      turnoverState: "cottage_scheduled",
      cottageTurnoverId: existing.id,
      cottageTurnoverTemplateId: existing.template_id,
    };
  }

  const templates = await activeDepartureTemplates(client, row);
  if (templates.length !== 1) {
    return {
      turnoverKind: "cottage_housekeeping",
      turnoverState: "cottage_configuration_required",
      cottageTurnoverId: null,
      cottageTurnoverTemplateId: null,
    };
  }

  const created = await createAutomaticCottageTurnover(
    client,
    row,
    actorUserId,
    templates[0].id,
  );

  return {
    turnoverKind: "cottage_housekeeping",
    turnoverState: "cottage_scheduled",
    cottageTurnoverId: created.id,
    cottageTurnoverTemplateId: created.template_id,
  };
}

export async function checkOutReservation({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  reservationId,
  expectedRowVersion,
  input,
  sourceChannel = "staff",
}) {
  await assertModify(actorUserId, campgroundId);
  const normalized = normalizeReservationCheckOutInput(input);
  const channel = normalizeCheckOutSourceChannel(sourceChannel);
  const expected = Number(expectedRowVersion);

  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Reservation row version is invalid.");
  }

  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "icamp-front-desk-check-out:" + reservationId,
    ]);

    const row = await reservationRow(client, campgroundId, reservationId, true);
    if (!row) throw new Error("Reservation was not found.");

    if (row.check_out_id) {
      await client.query("commit");
      return {
        reservationId,
        checkOutId: row.check_out_id,
        idempotent: true,
        checkedOutAt: iso(row.checked_out_at),
        turnoverState: row.turnover_state,
        cottageTurnoverId: row.cottage_turnover_id ?? null,
      };
    }

    if (row.status !== "checked_in") {
      throw new Error("Only checked-in reservations can be checked out.");
    }
    if (!row.check_in_id) {
      throw new Error(
        "Build 049 check-in evidence is required before checkout.",
      );
    }
    if (Number(row.row_version) !== expected) {
      throw new Error(
        "Reservation changed since this checkout page loaded. Refresh and try again.",
      );
    }
    if (row.campground_local_date < isoDate(row.arrival_date)) {
      throw new Error(
        "Checkout cannot be completed before the reservation arrival date.",
      );
    }

    const balance = balanceShape(row);
    const needsFinancialFollowUp =
      balance.outstandingBalanceCents > 0 || balance.financialReviewRequired;

    if (needsFinancialFollowUp && !normalized.financialFollowUpAcknowledged) {
      throw new Error(
        "Outstanding charges or financial review must be acknowledged for follow-up before checkout.",
      );
    }

    const rentalRequestCount = Number(row.rental_request_count ?? 0);
    const credentialRequestCount = Number(row.credential_request_count ?? 0);

    if (
      rentalRequestCount > 0 &&
      normalized.rentalReturnState === "not_applicable"
    ) {
      throw new Error(
        "Rental return status is required because arrival included rental handoffs.",
      );
    }
    if (
      credentialRequestCount > 0 &&
      normalized.credentialReturnState === "not_applicable"
    ) {
      throw new Error(
        "Credential return status is required because arrival included access-credential handoffs.",
      );
    }

    const updatedReservation = await client.query(
      `
        update public.reservations
        set status='completed',
            updated_by_user_id=$3
        where id=$1
          and campground_id=$2
          and row_version=$4
          and status='checked_in'
        returning row_version
      `,
      [reservationId, campgroundId, actorUserId, expected],
    );
    if (updatedReservation.rowCount !== 1) {
      throw new Error(
        "Reservation changed during checkout. Refresh and try again.",
      );
    }

    const credentialLifecycle = await revokeReservationCredentialsWithClient(
      client,
      {
        actorUserId,
        campgroundId,
        reservationId,
        reason: "Reservation checked out.",
      },
    );

    await resetAppRole(client);

    const accommodationStatus = await moveAccommodationToPostDepartureState(
      client,
      row,
      actorUserId,
    );

    const turnover = await resolveTurnoverHandoff(
      client,
      row,
      actorUserId,
      accommodationStatus,
    );

    await setAppRole(client, actorUserId);

    const inserted = await client.query(
      `
        insert into public.reservation_check_outs (
          organization_id,
          campground_id,
          reservation_id,
          check_in_id,
          accommodation_id,
          prior_reservation_status,
          reservation_total_cents,
          expected_payable_cents,
          captured_cents,
          outstanding_balance_cents,
          financial_review_required,
          financial_handoff_state,
          financial_acknowledged_at,
          rental_return_state,
          key_return_state,
          credential_return_state,
          return_notes,
          departure_notes,
          accommodation_status_before,
          accommodation_status_after,
          turnover_kind,
          turnover_state,
          cottage_turnover_id,
          cottage_turnover_template_id,
          source_channel,
          checked_out_by_user_id
        )
        values (
          $1,$2,$3,$4,$5,'checked_in',$6,$7,$8,$9,$10,$11,$12,
          $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
        )
        returning id,checked_out_at
      `,
      [
        row.organization_id,
        row.campground_id,
        row.id,
        row.check_in_id,
        row.accommodation_id,
        balance.reservationTotalCents,
        balance.expectedPayableCents,
        balance.capturedCents,
        balance.outstandingBalanceCents,
        balance.financialReviewRequired,
        needsFinancialFollowUp ? "follow_up_required" : "clear",
        needsFinancialFollowUp ? new Date().toISOString() : null,
        normalized.rentalReturnState,
        normalized.keyReturnState,
        normalized.credentialReturnState,
        normalized.returnNotes,
        normalized.departureNotes,
        accommodationStatus.before,
        accommodationStatus.after,
        turnover.turnoverKind,
        turnover.turnoverState,
        turnover.cottageTurnoverId,
        turnover.cottageTurnoverTemplateId,
        channel,
        actorUserId,
      ],
    );

    await resetAppRole(client);

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "reservation.front_desk.check_out",
      permissionKey: "reservation.modify",
      riskLevel: needsFinancialFollowUp ? "elevated" : "standard",
      reason: "Front desk departure checkout completed.",
      subjectType: "reservation",
      subjectId: reservationId,
      beforeState: {
        reservationStatus: row.status,
        reservationRowVersion: expected,
        accommodationStatus: accommodationStatus.before,
        outstandingBalanceCents: balance.outstandingBalanceCents,
        financialReviewRequired: balance.financialReviewRequired,
      },
      afterState: {
        reservationStatus: "completed",
        accommodationStatus: accommodationStatus.after,
        financialHandoffState: needsFinancialFollowUp
          ? "follow_up_required"
          : "clear",
        rentalReturnState: normalized.rentalReturnState,
        keyReturnState: normalized.keyReturnState,
        credentialReturnState: normalized.credentialReturnState,
        turnoverKind: turnover.turnoverKind,
        turnoverState: turnover.turnoverState,
        cottageTurnoverId: turnover.cottageTurnoverId,
      },
      metadata: {
        checkOutId: inserted.rows[0].id,
        sourceChannel: channel,
        rentalRequestCount,
        credentialRequestCount,
        cottageTurnoverBoundary: "Build 027",
        campsiteCleanupTaskBoundary: "Build 074",
        credentialLifecycleBoundary: "Build 062",
        credentialLifecycleRevokedCount: credentialLifecycle.changed,
      },
    });

    await client.query("commit");

    return {
      reservationId,
      checkOutId: inserted.rows[0].id,
      idempotent: false,
      checkedOutAt: iso(inserted.rows[0].checked_out_at),
      turnoverState: turnover.turnoverState,
      cottageTurnoverId: turnover.cottageTurnoverId,
      credentialLifecycleRevokedCount: credentialLifecycle.changed,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
