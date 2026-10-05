import pg from "pg";

import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  validateEmail,
  validatePassword,
  verifyPassword,
} from "./crypto.mjs";

const { Pool } = pg;

// Fixed public verifier used only to equalize unknown-account login work.
const DUMMY_PASSWORD_HASH =
  "scrypt$32768$8$1$MDEyMzQ1Njc4OWFiY2RlZg$" +
  "G2tWLj46hyFWyPjCE9DTU29T0KM2XmtProg_ewwiqP4";

let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required for authentication operations.");
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

export async function closeAuthPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function createGuestAccount({ email, password }) {
  const normalized = normalizeEmail(email);

  if (!validateEmail(normalized)) {
    throw new Error("A valid email address is required.");
  }

  const passwordValidation = validatePassword(password);

  if (!passwordValidation.ok) {
    throw new Error(passwordValidation.message);
  }

  const passwordHash = await hashPassword(password);
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const inserted = await client.query(
      `insert into icamp_private.user_accounts
        (email_normalized, account_type)
       values ($1, 'guest')
       returning id, email_normalized, account_type, email_verified_at, mfa_required`,
      [normalized],
    );

    const account = inserted.rows[0];

    await client.query(
      `insert into icamp_private.password_credentials
        (user_id, password_hash)
       values ($1, $2)`,
      [account.id, passwordHash],
    );

    await client.query("commit");

    return {
      id: account.id,
      email: account.email_normalized,
      accountType: account.account_type,
      emailVerifiedAt: account.email_verified_at,
      mfaRequired: account.mfa_required,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createStaffAccountForBootstrap({ email, password }) {
  const normalized = normalizeEmail(email);

  if (!validateEmail(normalized)) {
    throw new Error("A valid email address is required.");
  }

  const passwordValidation = validatePassword(password);

  if (!passwordValidation.ok) {
    throw new Error(passwordValidation.message);
  }

  const passwordHash = await hashPassword(password);
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const inserted = await client.query(
      `insert into icamp_private.user_accounts
        (email_normalized, account_type)
       values ($1, 'staff')
       returning id, email_normalized, account_type, email_verified_at, mfa_required`,
      [normalized],
    );

    const account = inserted.rows[0];

    await client.query(
      `insert into icamp_private.password_credentials
        (user_id, password_hash)
       values ($1, $2)`,
      [account.id, passwordHash],
    );

    await client.query("commit");

    return {
      id: account.id,
      email: account.email_normalized,
      accountType: account.account_type,
      emailVerifiedAt: account.email_verified_at,
      mfaRequired: account.mfa_required,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function recordFailedSignIn(client, userId, currentCount) {
  const next = currentCount + 1;
  const lock = next >= 5;

  await client.query(
    `update icamp_private.user_accounts
     set
       failed_sign_in_count = $2,
       locked_until = case
         when $3 then statement_timestamp() + interval '15 minutes'
         else locked_until
       end
     where id = $1`,
    [userId, next, lock],
  );
}

export async function authenticatePassword({ email, password }) {
  const normalized = normalizeEmail(email);

  if (!validateEmail(normalized)) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");

    const result = await client.query(
      `select
         a.id,
         a.email_normalized,
         a.account_type,
         a.account_state,
         a.email_verified_at,
         a.failed_sign_in_count,
         a.locked_until,
         a.mfa_required,
         p.password_hash
       from icamp_private.user_accounts a
       join icamp_private.password_credentials p on p.user_id = a.id
       where a.email_normalized = $1
       for update of a`,
      [normalized],
    );

    const row = result.rows[0];
    const valid = await verifyPassword(
      password,
      row?.password_hash ?? DUMMY_PASSWORD_HASH,
    );

    if (!row) {
      await client.query("commit");
      return null;
    }

    const locked =
      row.locked_until && new Date(row.locked_until).getTime() > Date.now();

    if (!valid || row.account_state !== "active" || locked) {
      if (!valid && row.account_state === "active" && !locked) {
        await recordFailedSignIn(
          client,
          row.id,
          row.failed_sign_in_count,
        );
      }

      await client.query("commit");
      return null;
    }

    await client.query(
      `update icamp_private.user_accounts
       set failed_sign_in_count = 0, locked_until = null
       where id = $1`,
      [row.id],
    );

    await client.query("commit");

    return {
      id: row.id,
      email: row.email_normalized,
      accountType: row.account_type,
      emailVerifiedAt: row.email_verified_at,
      mfaRequired: row.mfa_required,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createSession({
  userId,
  assuranceLevel = "aal1",
  expiresInSeconds = 43_200,
}) {
  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);

  const result = await getPool().query(
    `insert into icamp_private.auth_sessions
      (user_id, token_hash, assurance_level, expires_at)
     values ($1, $2, $3, statement_timestamp() + ($4 * interval '1 second'))
     returning id, expires_at`,
    [userId, tokenHash, assuranceLevel, expiresInSeconds],
  );

  return {
    token: rawToken,
    sessionId: result.rows[0].id,
    expiresAt: result.rows[0].expires_at,
  };
}

export async function getSessionByToken(rawToken) {
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashOpaqueToken(rawToken);
  const result = await getPool().query(
    `select
       s.id as session_id,
       s.assurance_level,
       s.created_at,
       s.last_seen_at,
       s.expires_at,
       a.id as user_id,
       a.email_normalized,
       a.account_type,
       a.account_state,
       a.email_verified_at,
       a.mfa_required
     from icamp_private.auth_sessions s
     join icamp_private.user_accounts a on a.id = s.user_id
     where s.token_hash = $1
       and s.revoked_at is null
       and s.expires_at > statement_timestamp()
       and a.account_state = 'active'
     limit 1`,
    [tokenHash],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const lastSeen = new Date(row.last_seen_at).getTime();

  if (Date.now() - lastSeen > 5 * 60 * 1000) {
    await getPool().query(
      `update icamp_private.auth_sessions
       set last_seen_at = statement_timestamp()
       where id = $1 and revoked_at is null`,
      [row.session_id],
    );
  }

  return {
    sessionId: row.session_id,
    assuranceLevel: row.assurance_level,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    user: {
      id: row.user_id,
      email: row.email_normalized,
      accountType: row.account_type,
      emailVerifiedAt: row.email_verified_at,
      mfaRequired: row.mfa_required,
    },
  };
}

export async function revokeSessionByToken(rawToken, reason = "logout") {
  if (!rawToken) {
    return false;
  }

  const result = await getPool().query(
    `update icamp_private.auth_sessions
     set
       revoked_at = statement_timestamp(),
       revoke_reason = $2
     where token_hash = $1
       and revoked_at is null`,
    [hashOpaqueToken(rawToken), String(reason).slice(0, 120)],
  );

  return result.rowCount > 0;
}

export async function issuePasswordRecovery({ email }) {
  const normalized = normalizeEmail(email);

  if (!validateEmail(normalized)) {
    return null;
  }

  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const account = await client.query(
      `select id, email_normalized
       from icamp_private.user_accounts
       where email_normalized = $1
         and account_state = 'active'
       for update`,
      [normalized],
    );

    const row = account.rows[0];

    if (!row) {
      await client.query("commit");
      return null;
    }

    await client.query(
      `update icamp_private.password_recovery_tokens
       set consumed_at = statement_timestamp()
       where user_id = $1
         and consumed_at is null`,
      [row.id],
    );

    await client.query(
      `insert into icamp_private.password_recovery_tokens
        (user_id, token_hash, expires_at)
       values ($1, $2, statement_timestamp() + interval '30 minutes')`,
      [row.id, tokenHash],
    );

    await client.query("commit");

    return {
      userId: row.id,
      email: row.email_normalized,
      token: rawToken,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function resetPasswordWithToken({ token, newPassword }) {
  const validation = validatePassword(newPassword);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const newHash = await hashPassword(newPassword);
  const tokenHash = hashOpaqueToken(token);
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const result = await client.query(
      `select id, user_id
       from icamp_private.password_recovery_tokens
       where token_hash = $1
         and consumed_at is null
         and expires_at > statement_timestamp()
       for update`,
      [tokenHash],
    );

    const recovery = result.rows[0];

    if (!recovery) {
      await client.query("rollback");
      return false;
    }

    await client.query(
      `update icamp_private.password_credentials
       set
         password_hash = $2,
         changed_at = statement_timestamp()
       where user_id = $1`,
      [recovery.user_id, newHash],
    );

    await client.query(
      `update icamp_private.password_recovery_tokens
       set consumed_at = statement_timestamp()
       where id = $1`,
      [recovery.id],
    );

    await client.query(
      "select icamp_private.revoke_user_sessions($1, $2)",
      [recovery.user_id, "password-reset"],
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
