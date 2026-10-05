import assert from "node:assert/strict";

import {
  authenticatePassword,
  closeAuthPoolForTests,
  createGuestAccount,
  createSession,
  createStaffAccountForBootstrap,
  getSessionByToken,
  issuePasswordRecovery,
  resetPasswordWithToken,
} from "../lib/auth/postgres.mjs";

const guestEmail = "auth-flow-guest@example.test";
const staffEmail = "auth-flow-staff@example.test";
const initialPassword = "Correct-Horse-Battery-1";
const replacementPassword = "Correct-Horse-Battery-2";

try {
  const guest = await createGuestAccount({
    email: guestEmail,
    password: initialPassword,
  });

  assert.equal(guest.accountType, "guest");

  const invalid = await authenticatePassword({
    email: guestEmail,
    password: "Incorrect-Password-1",
  });

  assert.equal(invalid, null);

  const authenticated = await authenticatePassword({
    email: guestEmail,
    password: initialPassword,
  });

  assert.equal(authenticated?.id, guest.id);

  const createdSession = await createSession({ userId: guest.id });
  assert.ok(createdSession.token.length >= 40);

  const activeSession = await getSessionByToken(createdSession.token);
  assert.equal(activeSession?.user.id, guest.id);
  assert.equal(activeSession?.assuranceLevel, "aal1");

  const recovery = await issuePasswordRecovery({ email: guestEmail });
  assert.ok(recovery);
  assert.ok(recovery.token.length >= 40);

  const reset = await resetPasswordWithToken({
    token: recovery.token,
    newPassword: replacementPassword,
  });

  assert.equal(reset, true);

  const reused = await resetPasswordWithToken({
    token: recovery.token,
    newPassword: initialPassword,
  });

  assert.equal(reused, false);

  const revokedSession = await getSessionByToken(createdSession.token);
  assert.equal(revokedSession, null);

  const oldPassword = await authenticatePassword({
    email: guestEmail,
    password: initialPassword,
  });

  assert.equal(oldPassword, null);

  const newPassword = await authenticatePassword({
    email: guestEmail,
    password: replacementPassword,
  });

  assert.equal(newPassword?.id, guest.id);

  const staff = await createStaffAccountForBootstrap({
    email: staffEmail,
    password: initialPassword,
  });

  const staffAuthenticated = await authenticatePassword({
    email: staffEmail,
    password: initialPassword,
  });

  assert.equal(staffAuthenticated?.id, staff.id);
  assert.equal(staffAuthenticated?.accountType, "staff");

  process.stdout.write("Authentication lifecycle verification passed.\n");
} finally {
  await closeAuthPoolForTests();
}
