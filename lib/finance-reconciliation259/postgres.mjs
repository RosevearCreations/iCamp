import pg from "pg";

import {
  getCampgroundFinanceCloseSource,
  settlementExpectedRows,
} from "../finance-close/postgres.mjs";
import { buildReconciliation259 } from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for reconciliation.");
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeReconciliationPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

export async function getCampgroundReconciliation259({
  userId,
  campgroundId,
  localDate,
}) {
  // Build 196 applies finance and reservation-read authorization and validates
  // the campground-local close date before any additional scoped source reads.
  const snapshot = await getCampgroundFinanceCloseSource({
    userId,
    campgroundId,
    localDate,
  });
  const { source } = snapshot;
  const reservations = new Set([
    ...source.payments.map((payment) => payment.reservationId),
    ...source.refunds.map((refund) => refund.reservationId),
  ]);
  const client = await getPool().connect();
  try {
    await client.query("begin read only");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const invoicesResult = await client.query(
      `select i.id,i.reservation_id,i.invoice_number,i.currency_code,
              i.reservation_amount_cents,i.security_deposit_cents,
              i.total_payable_cents,i.issued_at
       from public.reservation_invoices i
       where i.campground_id=$1
         and (i.reservation_id=any($2::uuid[])
              or (i.issued_at at time zone $4)::date=$3::date)
       order by i.issued_at desc,i.id desc
       limit 501`,
      [campgroundId, [...reservations], source.localDate, source.timezone],
    );
    const invoiceRowsTruncated = invoicesResult.rows.length > 500;
    const invoices = invoicesResult.rows.slice(0, 500).map((row) => ({
      id: row.id,
      reservationId: row.reservation_id,
      invoiceNumber: row.invoice_number,
      currencyCode: row.currency_code,
      reservationAmountCents: Number(row.reservation_amount_cents),
      securityDepositCents: Number(row.security_deposit_cents),
      totalPayableCents: Number(row.total_payable_cents),
      issuedAt: new Date(row.issued_at).toISOString(),
    }));
    for (const invoice of invoices) reservations.add(invoice.reservationId);
    const schedulesResult = await client.query(
      `select id,reservation_id,currency_code,booking_deposit_cents,
              total_payable_cents
       from public.reservation_payment_schedules
       where campground_id=$1 and reservation_id=any($2::uuid[])
       order by reservation_id,id
       limit 501`,
      [campgroundId, [...reservations]],
    );
    const scheduleRowsTruncated = schedulesResult.rows.length > 500;
    const schedules = schedulesResult.rows.slice(0, 500).map((row) => ({
      id: row.id,
      reservationId: row.reservation_id,
      currencyCode: row.currency_code,
      bookingDepositCents: Number(row.booking_deposit_cents),
      totalPayableCents: Number(row.total_payable_cents),
    }));
    await client.query("commit");
    return {
      source,
      financeReview: snapshot.review,
      reconciliation: buildReconciliation259({
        source,
        invoices,
        schedules,
        invoiceRowsTruncated,
        scheduleRowsTruncated,
      }),
      invoices,
      schedules,
      settlementExpected: settlementExpectedRows(source),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
