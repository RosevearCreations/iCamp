import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/0052_confirmations_receipts_reservation_documents.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0052_confirmations_receipts_reservation_documents.sql",
  import.meta.url,
);
const documentsPageUrl = new URL(
  "../app/booking/reservations/[reservationId]/documents/page.tsx",
  import.meta.url,
);
const printPageUrl = new URL(
  "../app/booking/reservations/[reservationId]/documents/print/page.tsx",
  import.meta.url,
);
const paymentActionUrl = new URL(
  "../app/booking/reservations/[reservationId]/payment/actions.ts",
  import.meta.url,
);
const repositoryUrl = new URL(
  "../lib/reservation-documents/postgres.mjs",
  import.meta.url,
);

test("Build 043 migration creates immutable confirmation, invoice and receipt ledgers", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.reservation_confirmations/u);
  assert.match(sql, /create table public\.reservation_invoices/u);
  assert.match(sql, /create table public\.reservation_receipts/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /reservation_receipts_payment_unique/u);
  assert.match(sql, /grant select on/u);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete)/iu);
});

test("Build 043 verification enforces trusted-server document writes", async () => {
  const sql = await readFile(verifyUrl, "utf8");

  assert.match(sql, /must remain trusted-server write only/u);
  assert.match(sql, /must allow only one confirmation per reservation/u);
  assert.match(sql, /must allow only one receipt per captured payment/u);
  assert.match(sql, /foreign-key coverage indexes are incomplete/u);
});

test("Build 043 payment completion synchronizes documents and confirmation", async () => {
  const source = await readFile(paymentActionUrl, "utf8");

  assert.match(source, /syncReservationDocuments/u);
  assert.match(source, /Confirm reservation & create documents|confirmation/u);
});

test("Build 043 exposes in-app and printable reservation documents", async () => {
  const [documents, printable, repository] = await Promise.all([
    readFile(documentsPageUrl, "utf8"),
    readFile(printPageUrl, "utf8"),
    readFile(repositoryUrl, "utf8"),
  ]);

  assert.match(documents, /In-app confirmation/u);
  assert.match(documents, /Printable view/u);
  assert.match(documents, /Captured payment evidence/u);
  assert.match(printable, /Print reservation documents/u);
  assert.match(repository, /communication_dispatches/u);
  assert.match(repository, /channel,\s*purpose/u);
  assert.match(repository, /'email','transactional'/u);
  assert.match(repository, /payment_state = 'captured'/u);
  assert.doesNotMatch(repository, /\b(card_number|pan|cvv|cvc)\b/iu);
});
