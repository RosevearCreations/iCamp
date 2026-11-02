import pg from "pg";

import { reauthenticateSession } from "./postgres.mjs";
import {
  acceptedTotpStep,
  generateTotpSeed,
  openTotpSeed,
  sealTotpSeed,
  totpSetupUri,
} from "./totp.mjs";

const { Pool } = pg;
let pool;

function db() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for MFA.");
    }
    pool = new Pool({ connectionString, max: 3 });
  }
  return pool;
}

export async function beginTotpEnrollment({
  userId,
  sessionId,
  password,
  username,
}) {
  const verified = await reauthenticateSession({ userId, sessionId, password });
  if (!verified) {
    return null;
  }
  const seed = generateTotpSeed();
  const envelope = sealTotpSeed(seed, userId);
  const client = await db().connect();
  try {
    await client.query("begin");
    const account = await client.query(
      `select id from icamp_private.user_accounts
       where id = $1 and account_state = 'active' for update`,
      [userId],
    );
    if (!account.rowCount) {
      throw new Error("Account is not active.");
    }
    const existing = await client.query(
      `select 1 from icamp_private.mfa_factors
       where user_id = $1 and factor_type = 'totp' and factor_state = 'verified'`,
      [userId],
    );
    if (existing.rowCount) {
      throw new Error(
        "An authenticator is already enrolled. Contact the trusted recovery operator.",
      );
    }
    await client.query(
      `update icamp_private.mfa_factors
       set factor_state = 'disabled', disabled_at = statement_timestamp()
       where user_id = $1 and factor_type = 'totp' and factor_state = 'pending'`,
      [userId],
    );
    await client.query(
      `insert into icamp_private.mfa_factors
         (user_id, factor_type, factor_state, provider_reference)
       values ($1, 'totp', 'pending', $2)`,
      [userId, envelope],
    );
    await client.query("commit");
    return { setupUri: totpSetupUri(username, seed), seed };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyTotpForSession({ userId, sessionId, code }) {
  if (!/^\d{6}$/u.test(String(code))) {
    return false;
  }
  const client = await db().connect();
  try {
    await client.query("begin");
    const account = await client.query(
      `select s.id from icamp_private.auth_sessions s
       join icamp_private.user_accounts u on u.id = s.user_id
       where s.id = $1 and s.user_id = $2 and s.revoked_at is null
         and s.expires_at > statement_timestamp() and u.account_state = 'active'
       for update of s`,
      [sessionId, userId],
    );
    if (!account.rowCount) {
      await client.query("rollback");
      return false;
    }
    const found = await client.query(
      `select id, provider_reference, factor_state, totp_last_accepted_step,
              totp_failed_attempts, totp_locked_until
       from icamp_private.mfa_factors
       where user_id = $1 and factor_type = 'totp'
         and factor_state in ('pending','verified')
       for update`,
      [userId],
    );
    const factor = found.rows[0];
    if (
      !factor ||
      (factor.totp_locked_until &&
        new Date(factor.totp_locked_until).getTime() > Date.now())
    ) {
      await client.query("commit");
      return false;
    }
    const seed = openTotpSeed(factor.provider_reference, userId);
    const step = acceptedTotpStep(
      seed,
      code,
      Number(factor.totp_last_accepted_step),
    );
    if (step === null) {
      await client.query(
        `update icamp_private.mfa_factors
         set totp_failed_attempts = least(totp_failed_attempts + 1, 100),
             totp_locked_until = case when totp_failed_attempts >= 4
               then statement_timestamp() + interval '15 minutes' else totp_locked_until end
         where id = $1`,
        [factor.id],
      );
      await client.query("commit");
      return false;
    }
    await client.query(
      `update icamp_private.mfa_factors
       set factor_state = 'verified', verified_at = coalesce(verified_at, statement_timestamp()),
           totp_last_accepted_step = $2, totp_failed_attempts = 0, totp_locked_until = null
       where id = $1`,
      [factor.id, step],
    );
    await client.query(
      `update icamp_private.auth_sessions
       set assurance_level = 'aal2', reauthenticated_at = statement_timestamp()
       where id = $1 and user_id = $2`,
      [sessionId, userId],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
