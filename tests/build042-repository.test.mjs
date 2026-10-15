import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/0050_deposits_balances_payment_provider.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0050_deposits_balances_payment_provider.sql",
  import.meta.url,
);
const webhookUrl = new URL(
  "../app/api/payments/webhook/route.ts",
  import.meta.url,
);
const paymentPageUrl = new URL(
  "../app/booking/reservations/[reservationId]/payment/page.tsx",
  import.meta.url,
);
const pendingPageUrl = new URL(
  "../app/booking/reservations/[reservationId]/pending/page.tsx",
  import.meta.url,
);
const managementPageUrl = new URL(
  "../app/workspaces/management/campgrounds/payments/page.tsx",
  import.meta.url,
);

test("Build 042 migration contains payment policy, schedule, attempts and private provider events", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.campground_payment_policies/u);
  assert.match(sql, /create table public\.reservation_payment_schedules/u);
  assert.match(sql, /create table public\.reservation_payments/u);
  assert.match(sql, /create table icamp_private\.payment_provider_events/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /payment_provider_events_provider_event_unique/u);
  assert.match(sql, /reservation_payments_provider_reference_uidx/u);

  assert.doesNotMatch(sql, /\b(card_number|pan|cvv|cvc)\b/iu);
});

test("Build 042 verification protects trusted-server payment writes", async () => {
  const sql = await readFile(verifyUrl, "utf8");

  assert.match(sql, /payment schedules must remain immutable to icamp_app/u);
  assert.match(sql, /payment attempts must be trusted-server write only/u);
  assert.match(sql, /provider event ledger must remain private/u);
});

test("Build 042 webhook route requires HMAC signature verification", async () => {
  const source = await readFile(webhookUrl, "utf8");

  assert.match(source, /verifyPaymentWebhookSignature/u);
  assert.match(source, /x-icamp-payment-timestamp/u);
  assert.match(source, /x-icamp-payment-signature/u);
  assert.match(source, /ingestPaymentProviderEvent/u);
});

test("Build 042 exposes guest payment and campground policy experiences", async () => {
  const [payment, pending, management] = await Promise.all([
    readFile(paymentPageUrl, "utf8"),
    readFile(pendingPageUrl, "utf8"),
    readFile(managementPageUrl, "utf8"),
  ]);

  assert.match(payment, /Complete sandbox payment/u);
  assert.match(payment, /Raw card numbers/u);
  assert.match(pending, /Review deposit, balance & payment/u);
  assert.match(management, /Deposit mode/u);
  assert.match(management, /Security deposit due/u);
});
