import pg from "pg";

import {
  createMockCommunicationsProvider,
  getCommunicationsProviderConfig,
} from "../communications/provider.mjs";
import { recordCommunicationAttempt } from "../communications/postgres.mjs";
import {
  confirmationSnapshot,
  deterministicDocumentNumber,
  reservationConfirmationEligibility,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "DATABASE_URL is required for reservation document operations.",
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

export async function closeReservationDocumentsPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

function isoDate(value) {
  return String(value).slice(0, 10);
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function mapConfirmation(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.confirmation_number,
    currencyCode: row.currency_code,
    reservationTotalCents: Number(row.reservation_total_cents),
    bookingDueCents: Number(row.booking_due_cents),
    capturedAtConfirmationCents: Number(
      row.captured_at_confirmation_cents,
    ),
    securityDepositCents: Number(row.security_deposit_cents),
    balanceDueDate: isoDate(row.balance_due_date),
    confirmedAt: iso(row.confirmed_at),
  };
}

function mapInvoice(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.invoice_number,
    currencyCode: row.currency_code,
    reservationAmountCents: Number(row.reservation_amount_cents),
    securityDepositCents: Number(row.security_deposit_cents),
    totalPayableCents: Number(row.total_payable_cents),
    issuedAt: iso(row.issued_at),
  };
}

function mapReceipt(row) {
  return {
    id: row.id,
    number: row.receipt_number,
    paymentId: row.payment_id,
    paymentPurpose: row.payment_purpose,
    currencyCode: row.currency_code,
    amountCents: Number(row.amount_cents),
    issuedAt: iso(row.issued_at),
  };
}

async function reservationEvidence(client, userId, reservationId, lock = false) {
  const result = await client.query(
    `select
       r.id,
       r.organization_id,
       r.campground_id,
       r.status,
       r.arrival_date,
       r.departure_date,
       r.guest_user_id,
       c.name as campground_name,
       c.slug as campground_slug,
       a.code as accommodation_code,
       a.display_name as accommodation_name,
       d.primary_first_name,
       d.primary_last_name,
       d.contact_email,
       d.contact_phone,
       d.occupant_count,
       d.visitor_count,
       d.pet_count,
       d.vehicle_count,
       d.currency_code,
       d.stay_subtotal_cents,
       d.charge_total_cents,
       d.quoted_total_cents,
       s.id as payment_schedule_id,
       s.booking_deposit_cents,
       s.reservation_balance_cents,
       s.security_deposit_cents,
       s.security_deposit_due_stage,
       s.balance_due_mode,
       s.balance_due_date,
       s.booking_due_cents,
       s.total_payable_cents,
       coalesce(sum(p.amount_cents) filter (
         where p.payment_state = 'captured'
       ), 0)::bigint as captured_cents
     from public.reservations r
     join public.reservation_checkout_details d
       on d.reservation_id = r.id
      and d.guest_user_id = r.guest_user_id
     join public.reservation_payment_schedules s
       on s.reservation_id = r.id
      and s.guest_user_id = r.guest_user_id
     join public.campgrounds c on c.id = r.campground_id
     join public.accommodations a on a.id = r.accommodation_id
     left join public.reservation_payments p
       on p.reservation_id = r.id
     where r.id = $1
       and r.guest_user_id = $2
     group by
       r.id,
       r.organization_id,
       r.campground_id,
       r.status,
       r.arrival_date,
       r.departure_date,
       r.guest_user_id,
       c.name,
       c.slug,
       a.code,
       a.display_name,
       d.primary_first_name,
       d.primary_last_name,
       d.contact_email,
       d.contact_phone,
       d.occupant_count,
       d.visitor_count,
       d.pet_count,
       d.vehicle_count,
       d.currency_code,
       d.stay_subtotal_cents,
       d.charge_total_cents,
       d.quoted_total_cents,
       s.id,
       s.booking_deposit_cents,
       s.reservation_balance_cents,
       s.security_deposit_cents,
       s.security_deposit_due_stage,
       s.balance_due_mode,
       s.balance_due_date,
       s.booking_due_cents,
       s.total_payable_cents
     limit 1
     ${lock ? "for update of r" : ""}`,
    [reservationId, userId],
  );
  return result.rows[0] ?? null;
}

async function createReceipts(client, row) {
  const payments = await client.query(
    `select *
     from public.reservation_payments
     where reservation_id = $1
       and guest_user_id = $2
       and payment_state = 'captured'
     order by captured_at asc nulls last, created_at asc`,
    [row.id, row.guest_user_id],
  );

  let created = 0;
  for (const payment of payments.rows) {
    const receiptNumber = deterministicDocumentNumber("RCT", payment.id);
    const snapshot = {
      version: 1,
      reservationId: row.id,
      paymentId: payment.id,
      paymentPurpose: payment.payment_purpose,
      amountCents: Number(payment.amount_cents),
      currencyCode: payment.currency_code,
      providerKey: payment.provider_key,
      providerReference: payment.provider_payment_reference,
      capturedAt: iso(payment.captured_at),
      rawPaymentCredentialsExcluded: true,
    };

    const inserted = await client.query(
      `insert into public.reservation_receipts (
         organization_id,
         campground_id,
         reservation_id,
         guest_user_id,
         payment_id,
         receipt_number,
         payment_purpose,
         currency_code,
         amount_cents,
         document_snapshot
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       on conflict (payment_id) do nothing
       returning id`,
      [
        row.organization_id,
        row.campground_id,
        row.id,
        row.guest_user_id,
        payment.id,
        receiptNumber,
        payment.payment_purpose,
        payment.currency_code,
        Number(payment.amount_cents),
        JSON.stringify(snapshot),
      ],
    );
    created += inserted.rowCount;
  }
  return created;
}

async function queueConfirmationEmail(client, row, confirmationId) {
  const endpoint = await client.query(
    `insert into icamp_private.communication_endpoints (
       organization_id,
       campground_id,
       owner_user_id,
       endpoint_kind,
       endpoint_value,
       display_hint,
       lifecycle_state
     )
     values ($1,$2,$3,'email',$4,$5,'active')
     on conflict (
       organization_id,
       campground_id,
       endpoint_kind,
       endpoint_value
     )
     do update set
       owner_user_id = excluded.owner_user_id,
       lifecycle_state = 'active'
     returning id`,
    [
      row.organization_id,
      row.campground_id,
      row.guest_user_id,
      row.contact_email,
      row.contact_email.replace(/^(.{1,2}).*(@.*)$/u, "$1…$2"),
    ],
  );

  const dispatch = await client.query(
    `insert into icamp_private.communication_dispatches (
       organization_id,
       campground_id,
       endpoint_id,
       direction,
       channel,
       purpose,
       idempotency_key,
       content_reference,
       max_attempts,
       created_by_user_id
     )
     values (
       $1,$2,$3,'outbound','email','transactional',$4,$5,5,$6
     )
     on conflict (campground_id, idempotency_key)
     do update set id = icamp_private.communication_dispatches.id
     returning id, delivery_state`,
    [
      row.organization_id,
      row.campground_id,
      endpoint.rows[0].id,
      "reservation-confirmation:" + row.id + ":email",
      "reservation-confirmation:" + confirmationId,
      row.guest_user_id,
    ],
  );

  return {
    id: dispatch.rows[0].id,
    state: dispatch.rows[0].delivery_state,
    endpointHint: row.contact_email.replace(
      /^(.{1,2}).*(@.*)$/u,
      "$1…$2",
    ),
  };
}

async function completeMockEmail(dispatch) {
  if (!dispatch || dispatch.state === "delivered") return dispatch?.state ?? null;

  const config = getCommunicationsProviderConfig();
  if (config.mode !== "mock") return dispatch.state;

  const provider = createMockCommunicationsProvider({
    providerKey: config.provider,
  });
  const result = await provider.dispatch({
    dispatchId: dispatch.id,
    channel: "email",
    purpose: "transactional",
    endpointHint: dispatch.endpointHint,
    idempotencyKey: "reservation-confirmation:" + dispatch.id,
  });

  const updated = await recordCommunicationAttempt({
    dispatchId: dispatch.id,
    providerKey: result.providerKey,
    attemptState: "delivered",
    retryable: false,
    providerReference: result.providerReference,
  });
  return updated.deliveryState;
}

export async function syncReservationDocuments({ userId, reservationId }) {
  const client = await getPool().connect();
  let dispatch = null;

  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-confirmation:" + reservationId],
    );

    const row = await reservationEvidence(
      client,
      userId,
      reservationId,
      true,
    );
    if (!row) {
      await client.query("commit");
      return null;
    }

    if (!["pending", "confirmed"].includes(row.status)) {
      throw new Error(
        "Reservation is not eligible for confirmation document synchronization.",
      );
    }

    await createReceipts(client, row);

    const eligibility = reservationConfirmationEligibility({
      bookingDueCents: Number(row.booking_due_cents),
      capturedCents: Number(row.captured_cents),
    });

    if (!eligibility.eligible) {
      await client.query("commit");
      return {
        confirmed: false,
        shortfallCents: eligibility.shortfallCents,
      };
    }

    const snapshot = confirmationSnapshot({
      reservation: {
        id: row.id,
        status: row.status,
        arrivalDate: isoDate(row.arrival_date),
        departureDate: isoDate(row.departure_date),
        campgroundName: row.campground_name,
        accommodationCode: row.accommodation_code,
        accommodationName: row.accommodation_name,
      },
      checkout: {
        contactName:
          row.primary_first_name + " " + row.primary_last_name,
        contactEmail: row.contact_email,
        occupants: Number(row.occupant_count),
        visitors: Number(row.visitor_count),
        pets: Number(row.pet_count),
        vehicles: Number(row.vehicle_count),
        currencyCode: row.currency_code,
        staySubtotalCents: Number(row.stay_subtotal_cents),
        chargeTotalCents: Number(row.charge_total_cents),
        totalCents: Number(row.quoted_total_cents),
      },
      schedule: {
        bookingDueCents: Number(row.booking_due_cents),
        bookingDepositCents: Number(row.booking_deposit_cents),
        reservationBalanceCents: Number(row.reservation_balance_cents),
        securityDepositCents: Number(row.security_deposit_cents),
        securityDepositDueStage: row.security_deposit_due_stage,
        balanceDueMode: row.balance_due_mode,
        balanceDueDate: isoDate(row.balance_due_date),
        totalPayableCents: Number(row.total_payable_cents),
      },
      capturedCents: Number(row.captured_cents),
    });

    const confirmationNumber = deterministicDocumentNumber("IC", row.id);
    await client.query(
      `insert into public.reservation_confirmations (
         organization_id,
         campground_id,
         reservation_id,
         guest_user_id,
         payment_schedule_id,
         confirmation_number,
         currency_code,
         reservation_total_cents,
         booking_due_cents,
         captured_at_confirmation_cents,
         security_deposit_cents,
         balance_due_date,
         document_snapshot
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::jsonb)
       on conflict (reservation_id) do nothing`,
      [
        row.organization_id,
        row.campground_id,
        row.id,
        row.guest_user_id,
        row.payment_schedule_id,
        confirmationNumber,
        row.currency_code,
        Number(row.quoted_total_cents),
        Number(row.booking_due_cents),
        Number(row.captured_cents),
        Number(row.security_deposit_cents),
        isoDate(row.balance_due_date),
        JSON.stringify(snapshot),
      ],
    );

    const confirmation = await client.query(
      `select *
       from public.reservation_confirmations
       where reservation_id = $1
       limit 1`,
      [row.id],
    );

    const confirmationRow = confirmation.rows[0];
    const invoiceNumber = deterministicDocumentNumber("INV", row.id);
    await client.query(
      `insert into public.reservation_invoices (
         organization_id,
         campground_id,
         reservation_id,
         guest_user_id,
         confirmation_id,
         invoice_number,
         currency_code,
         reservation_amount_cents,
         security_deposit_cents,
         total_payable_cents,
         document_snapshot
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       on conflict (reservation_id) do nothing`,
      [
        row.organization_id,
        row.campground_id,
        row.id,
        row.guest_user_id,
        confirmationRow.id,
        invoiceNumber,
        row.currency_code,
        Number(row.quoted_total_cents),
        Number(row.security_deposit_cents),
        Number(row.total_payable_cents),
        JSON.stringify({
          version: 1,
          confirmationNumber: confirmationRow.confirmation_number,
          acceptedQuote: snapshot.acceptedQuote,
          paymentSchedule: snapshot.paymentSchedule,
          refundableSecurityDepositSeparated: true,
        }),
      ],
    );

    if (row.status === "pending") {
      await client.query(
        `update public.reservations
         set status = 'confirmed',
             updated_by_user_id = $2
         where id = $1
           and status = 'pending'`,
        [row.id, row.guest_user_id],
      );
    }

    dispatch = await queueConfirmationEmail(
      client,
      row,
      confirmationRow.id,
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const emailState = await completeMockEmail(dispatch);
  const bundle = await getReservationDocumentBundle({
    userId,
    reservationId,
  });

  return bundle
    ? {
        ...bundle,
        confirmed: true,
        emailState: emailState ?? bundle.email.state,
      }
    : null;
}

export async function getReservationDocumentBundle({
  userId,
  reservationId,
}) {
  const rowResult = await getPool().query(
    `select
       r.id,
       r.status,
       r.arrival_date,
       r.departure_date,
       c.name as campground_name,
       c.slug as campground_slug,
       a.code as accommodation_code,
       a.display_name as accommodation_name,
       d.primary_first_name,
       d.primary_last_name,
       d.contact_email,
       d.contact_phone,
       d.occupant_count,
       d.visitor_count,
       d.pet_count,
       d.vehicle_count,
       d.currency_code,
       d.stay_subtotal_cents,
       d.charge_total_cents,
       d.quoted_total_cents,
       s.booking_deposit_cents,
       s.reservation_balance_cents,
       s.security_deposit_cents,
       s.security_deposit_due_stage,
       s.balance_due_mode,
       s.balance_due_date,
       s.booking_due_cents,
       s.total_payable_cents,
       coalesce(sum(p.amount_cents) filter (
         where p.payment_state = 'captured'
       ), 0)::bigint as captured_cents
     from public.reservations r
     join public.reservation_checkout_details d
       on d.reservation_id = r.id
      and d.guest_user_id = r.guest_user_id
     join public.reservation_payment_schedules s
       on s.reservation_id = r.id
      and s.guest_user_id = r.guest_user_id
     join public.campgrounds c on c.id = r.campground_id
     join public.accommodations a on a.id = r.accommodation_id
     left join public.reservation_payments p
       on p.reservation_id = r.id
     where r.id = $1
       and r.guest_user_id = $2
     group by
       r.id,
       r.status,
       r.arrival_date,
       r.departure_date,
       c.name,
       c.slug,
       a.code,
       a.display_name,
       d.primary_first_name,
       d.primary_last_name,
       d.contact_email,
       d.contact_phone,
       d.occupant_count,
       d.visitor_count,
       d.pet_count,
       d.vehicle_count,
       d.currency_code,
       d.stay_subtotal_cents,
       d.charge_total_cents,
       d.quoted_total_cents,
       s.booking_deposit_cents,
       s.reservation_balance_cents,
       s.security_deposit_cents,
       s.security_deposit_due_stage,
       s.balance_due_mode,
       s.balance_due_date,
       s.booking_due_cents,
       s.total_payable_cents
     limit 1`,
    [reservationId, userId],
  );
  if (rowResult.rowCount !== 1) return null;

  const [confirmation, invoice, receipts, email] = await Promise.all([
    getPool().query(
      `select *
       from public.reservation_confirmations
       where reservation_id = $1
         and guest_user_id = $2
       limit 1`,
      [reservationId, userId],
    ),
    getPool().query(
      `select *
       from public.reservation_invoices
       where reservation_id = $1
         and guest_user_id = $2
       limit 1`,
      [reservationId, userId],
    ),
    getPool().query(
      `select *
       from public.reservation_receipts
       where reservation_id = $1
         and guest_user_id = $2
       order by issued_at asc`,
      [reservationId, userId],
    ),
    getPool().query(
      `select d.delivery_state
       from icamp_private.communication_dispatches d
       where d.campground_id = (
         select campground_id
         from public.reservations
         where id = $1
           and guest_user_id = $2
       )
         and d.idempotency_key =
           'reservation-confirmation:' || $1::text || ':email'
       limit 1`,
      [reservationId, userId],
    ),
  ]);

  const row = rowResult.rows[0];
  return {
    reservation: {
      id: row.id,
      status: row.status,
      campgroundName: row.campground_name,
      campgroundSlug: row.campground_slug,
      accommodationCode: row.accommodation_code,
      accommodationName: row.accommodation_name,
      arrivalDate: isoDate(row.arrival_date),
      departureDate: isoDate(row.departure_date),
    },
    guest: {
      name: row.primary_first_name + " " + row.primary_last_name,
      email: row.contact_email,
      phone: row.contact_phone,
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
    payment: {
      bookingDepositCents: Number(row.booking_deposit_cents),
      reservationBalanceCents: Number(row.reservation_balance_cents),
      securityDepositCents: Number(row.security_deposit_cents),
      securityDepositDueStage: row.security_deposit_due_stage,
      balanceDueMode: row.balance_due_mode,
      balanceDueDate: isoDate(row.balance_due_date),
      bookingDueCents: Number(row.booking_due_cents),
      totalPayableCents: Number(row.total_payable_cents),
      capturedCents: Number(row.captured_cents),
    },
    confirmation: mapConfirmation(confirmation.rows[0]),
    invoice: mapInvoice(invoice.rows[0]),
    receipts: receipts.rows.map(mapReceipt),
    email: {
      state: email.rows[0]?.delivery_state ?? "not_queued",
    },
  };
}
