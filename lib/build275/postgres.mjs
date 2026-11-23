import { originalPool270 } from "../build270/postgres.mjs";
import { originalAdmission273 } from "../build273/postgres.mjs";
import { SOURCES275, pins275, verifySigned275 } from "./diagnostics.mjs";

export function configuredSources275() {
  const registry = pins275(process.env.ICAMP_275_SOURCE_PINS_JSON);
  return SOURCES275.filter((name) => Boolean(registry[name]));
}

async function schemaReady275() {
  const previous = await originalAdmission273();
  if (!previous.adopted || !previous.hostPinned) return false;
  const result = await originalPool270().query(
    "select to_regclass('icamp_private.signed_source_handshake275') is not null as tab," +
      "exists(select 1 from icamp_meta.schema_migrations where version='0249') as migration",
  );
  return result.rows[0]?.tab === true && result.rows[0]?.migration === true;
}

export async function handshakeSummary275() {
  const out = {
    status: "HOLD_ORIGINAL_0249_OR_PIN",
    schemaReady: false,
    receipts: [],
  };
  try {
    if (!(await schemaReady275())) return out;
    out.schemaReady = true;
    const rows = await originalPool270().query(
      "select distinct on (source_id) source_id,key_id,commit_sha,observed_at " +
        "from icamp_private.signed_source_handshake275 " +
        "where observed_at >= statement_timestamp()-interval '5 minutes' " +
        "and observed_at <= statement_timestamp()+interval '30 seconds' " +
        "order by source_id,observed_at desc",
    );
    const pins = pins275(process.env.ICAMP_275_SOURCE_PINS_JSON);
    out.receipts = rows.rows
      .filter(
        (r) =>
          pins[r.source_id]?.keyId === r.key_id &&
          pins[r.source_id]?.commitSha === r.commit_sha,
      )
      .map((r) => ({
        source: r.source_id,
        observedAt: new Date(r.observed_at).toISOString(),
      }));
    out.status = "ORIGINAL_RECEIPTS_PENDING_INDEPENDENT_REVIEW";
  } catch {
    out.status = "HOLD_ORIGINAL_HANDSHAKE_READBACK";
  }
  return out;
}

export async function acceptHandshake275(body, signature) {
  const receipt = verifySigned275({
    body,
    signature,
    pins: pins275(process.env.ICAMP_275_SOURCE_PINS_JSON),
  });
  if (!(await schemaReady275())) throw Error("ORIGINAL_LEDGER_UNAVAILABLE");
  const result = await originalPool270().query(
    "insert into icamp_private.signed_source_handshake275 " +
      "(source_id,key_id,commit_sha,challenge_id,nonce,observed_at," +
      "signed_body,signature_b64url,body_sha256) " +
      "values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing returning id",
    [
      receipt.source,
      receipt.keyId,
      receipt.commitSha,
      receipt.challengeId,
      receipt.nonce,
      receipt.observedAt,
      receipt.body,
      receipt.signature,
      receipt.digest,
    ],
  );
  if (result.rowCount !== 1) throw Error("RECEIPT_REPLAY_OR_DB_DENIAL");
  return { accepted: true, status: "SIGNED_EVIDENCE_STORED_NOT_CERTIFIED" };
}
