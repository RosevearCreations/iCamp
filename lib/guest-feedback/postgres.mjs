import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  feedbackUuid,
  normalizeFeedbackAppeal,
  normalizeFeedbackDecision,
  normalizeFeedbackRecovery,
  normalizeGuestFeedback,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) throw new Error("Feedback database is unavailable.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeFeedbackPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const day = (value) =>
  value == null
    ? null
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
const iso = (value) => (value == null ? null : new Date(value).toISOString());

async function requireGuest(client, userId) {
  feedbackUuid(userId, "Guest");
  const result = await client.query(
    `select 1 from icamp_private.user_accounts where id=$1 and account_type='guest' and account_state='active'`,
    [userId],
  );
  if (result.rowCount !== 1)
    throw new Error("An active guest account is required.");
}

async function requireManager(userId, campgroundId) {
  feedbackUuid(campgroundId, "Campground");
  if (!(await hasCampgroundPermission(userId, campgroundId, "guest.manage")))
    throw new Error(
      "Guest management permission is required for feedback moderation.",
    );
}

async function audit(
  client,
  {
    actorUserId,
    actorSessionId,
    organizationId,
    campgroundId,
    subjectId,
    actionKey,
    beforeState,
    afterState,
    manager = false,
  },
) {
  await appendAuditEvent(client, {
    actorUserId,
    actorSessionId,
    organizationId,
    campgroundId,
    subjectType: "guest_feedback",
    subjectId,
    actionKey,
    beforeState,
    afterState,
    permissionKey: manager ? "guest.manage" : null,
    metadata: { build: 184, billing: "held", omnichannel: "held" },
  });
}

function mapReview(row) {
  return {
    id: row.id,
    campgroundId: row.campground_id,
    campgroundName: row.campground_name,
    campgroundSlug: row.campground_slug,
    reservationId: row.reservation_id,
    guestUserId: row.guest_user_id,
    assistanceCaseId: row.assistance_case_id,
    assistanceCaseState: row.assistance_case_state ?? null,
    rating: Number(row.rating),
    category: row.category,
    title: row.title,
    publicSummary: row.public_summary,
    privateDetails: row.private_details,
    publicRequested: row.public_requested,
    moderationState: row.moderation_state,
    moderationReason: row.moderation_reason ?? null,
    appealPending: row.appeal_pending,
    appealReason: row.appeal_reason ?? null,
    recoveryStage: row.recovery_stage,
    recoveryDueDate: day(row.recovery_due_date),
    recoveryUpdatedAt: iso(row.recovery_updated_at),
    submittedAt: iso(row.submitted_at),
    updatedAt: iso(row.updated_at),
    rowVersion: Number(row.row_version),
    editable: row.editable === true,
    moderationHistory: [],
    recoveryHistory: [],
  };
}

async function withHistory(client, rows) {
  const ids = rows.map((item) => item.id);
  if (!ids.length) return rows;
  const [moderation, recovery] = await Promise.all([
    client.query(
      `select feedback_id,event_kind,reason,occurred_at from icamp_private.guest_feedback_moderation_events
      where feedback_id=any($1::uuid[]) order by occurred_at,id limit 1500`,
      [ids],
    ),
    client.query(
      `select feedback_id,recovery_stage,guest_visible_summary,occurred_at,due_date
      from icamp_private.guest_feedback_recovery_events
      where feedback_id=any($1::uuid[]) order by occurred_at,id limit 1500`,
      [ids],
    ),
  ]);
  const byId = new Map(rows.map((item) => [item.id, item]));
  for (const row of moderation.rows)
    byId.get(row.feedback_id)?.moderationHistory.push({
      eventKind: row.event_kind,
      reason: row.reason,
      occurredAt: iso(row.occurred_at),
    });
  for (const row of recovery.rows)
    byId.get(row.feedback_id)?.recoveryHistory.push({
      stage: row.recovery_stage,
      summary: row.guest_visible_summary,
      dueDate: day(row.due_date),
      occurredAt: iso(row.occurred_at),
    });
  return rows;
}

const OWN_REVIEW_SELECT = `select f.*,c.name campground_name,c.slug campground_slug,
  ca.case_state assistance_case_state,
  (r.status='completed' and r.departure_date<= (statement_timestamp() at time zone c.timezone)::date
   and r.departure_date >= (statement_timestamp() at time zone c.timezone)::date-180) editable
  from icamp_private.verified_guest_feedback f
  join public.campgrounds c on c.id=f.campground_id
  join public.reservations r on r.id=f.reservation_id
  left join public.camper_assistance_cases ca on ca.id=f.assistance_case_id`;

export async function listFeedbackCampgrounds() {
  const result = await getPool().query(
    `select id,name,slug from public.campgrounds where lifecycle_state='active' order by name,id limit 200`,
  );
  return result.rows.map(({ id, name, slug }) => ({ id, name, slug }));
}

export async function listPublicGuestReviews({
  campgroundSlug = "",
  category = "",
  rating = "",
} = {}) {
  const safeRating = /^[1-5]$/u.test(String(rating)) ? Number(rating) : 0;
  const result = await getPool().query(
    `select f.id,f.rating,f.category,f.title,f.public_summary,f.submitted_at,
       c.name campground_name,c.slug campground_slug
     from icamp_private.verified_guest_feedback f
     join public.campgrounds c on c.id=f.campground_id
     join public.reservations r on r.id=f.reservation_id
     join icamp_private.user_accounts u on u.id=f.guest_user_id
     where f.public_requested=true and f.moderation_state='approved'
       and r.status='completed' and c.lifecycle_state='active'
       and u.account_state='active'
       and ($1::text='' or c.slug=$1)
       and ($2::text='' or f.category=$2)
       and ($3::integer=0 or f.rating=$3)
     order by f.submitted_at desc,f.id limit 100`,
    [
      String(campgroundSlug).slice(0, 100),
      String(category).slice(0, 30),
      safeRating,
    ],
  );
  // The public DTO deliberately never includes guest identity, reservation,
  // linked assistance case, private details or recovery notes.
  return result.rows.map((row) => ({
    id: row.id,
    rating: Number(row.rating),
    category: row.category,
    title: row.title,
    summary: row.public_summary,
    campgroundName: row.campground_name,
    campgroundSlug: row.campground_slug,
    submittedAt: iso(row.submitted_at),
  }));
}

export async function listFeedbackEligibleStays({ userId }) {
  feedbackUuid(userId, "Guest");
  const result = await getPool().query(
    `select r.id,r.campground_id,r.organization_id,c.name campground_name,
      r.arrival_date,r.departure_date,a.code accommodation_code
     from public.reservations r
     join public.campgrounds c on c.id=r.campground_id
     join public.accommodations a on a.id=r.accommodation_id
     where r.guest_user_id=$1 and r.status='completed' and c.lifecycle_state='active'
       and r.departure_date <= (statement_timestamp() at time zone c.timezone)::date
       and r.departure_date >= (statement_timestamp() at time zone c.timezone)::date-180
     order by r.departure_date desc,r.id limit 100`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    campgroundId: row.campground_id,
    campgroundName: row.campground_name,
    arrivalDate: day(row.arrival_date),
    departureDate: day(row.departure_date),
    accommodationCode: row.accommodation_code,
  }));
}

export async function listOwnFeedbackCases({ userId }) {
  feedbackUuid(userId, "Guest");
  const result = await getPool().query(
    `select ca.id,ar.reservation_id,ca.case_state,ar.summary
     from public.camper_assistance_cases ca
     join public.camper_assistance_requests ar on ar.id=ca.request_id
     where ar.guest_user_id=$1 order by ca.created_at desc limit 100`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    reservationId: row.reservation_id,
    caseState: row.case_state,
    summary: row.summary,
  }));
}

export async function listOwnGuestFeedback({ userId }) {
  feedbackUuid(userId, "Guest");
  return transaction(async (client) => {
    await requireGuest(client, userId);
    const result = await client.query(
      `${OWN_REVIEW_SELECT} where f.guest_user_id=$1 order by f.updated_at desc,f.id limit 100`,
      [userId],
    );
    return withHistory(client, result.rows.map(mapReview));
  });
}

async function appendModerationEvent(
  client,
  feedback,
  actorUserId,
  eventKind,
  reason = "",
) {
  await client.query(
    `insert into icamp_private.guest_feedback_moderation_events
     (organization_id,campground_id,feedback_id,actor_user_id,event_kind,reason)
     values($1,$2,$3,$4,$5,$6)`,
    [
      feedback.organization_id,
      feedback.campground_id,
      feedback.id,
      actorUserId,
      eventKind,
      reason,
    ],
  );
}

export async function saveGuestFeedback({
  userId,
  actorSessionId,
  reservationId,
  feedbackId,
  expectedRowVersion,
  input,
}) {
  feedbackUuid(reservationId, "Reservation");
  if (feedbackId) feedbackUuid(feedbackId, "Feedback");
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 0)
    throw new Error("Feedback version is invalid.");
  const normalized = normalizeGuestFeedback(input);
  return transaction(async (client) => {
    await requireGuest(client, userId);
    const stay = await client.query(
      `select r.organization_id,r.campground_id from public.reservations r
       join public.campgrounds c on c.id=r.campground_id
       where r.id=$1 and r.guest_user_id=$2 and r.status='completed' and c.lifecycle_state='active'
       and r.departure_date <= (statement_timestamp() at time zone c.timezone)::date
       and r.departure_date >= (statement_timestamp() at time zone c.timezone)::date-180
       for share of r`,
      [reservationId, userId],
    );
    if (stay.rowCount !== 1)
      throw new Error(
        "A completed stay within 180 days is required for feedback.",
      );
    const { organization_id: organizationId, campground_id: campgroundId } =
      stay.rows[0];
    const existing = await client.query(
      `select * from icamp_private.verified_guest_feedback where reservation_id=$1 for update`,
      [reservationId],
    );
    const before = existing.rows[0] ?? null;
    if (
      (before ? Number(before.row_version) : 0) !== expectedRowVersion ||
      (feedbackId && before?.id !== feedbackId) ||
      (!feedbackId && before)
    )
      throw new Error(
        "Feedback already exists or has changed. Refresh the current version.",
      );
    if (before && before.guest_user_id !== userId)
      throw new Error("Feedback belongs to another guest.");
    const values = [
      normalized.rating,
      normalized.category,
      normalized.title,
      normalized.publicSummary,
      normalized.privateDetails,
      normalized.publicRequested,
      normalized.assistanceCaseId,
    ];
    const saved = before
      ? await client.query(
          `update icamp_private.verified_guest_feedback
       set rating=$1,category=$2,title=$3,public_summary=$4,private_details=$5,public_requested=$6,
         assistance_case_id=$7,moderation_state='pending',moderation_reason=null,
         moderated_by_user_id=null,moderated_at=null,appeal_pending=false,appeal_reason=null,appeal_requested_at=null
       where id=$8 returning *`,
          [...values, before.id],
        )
      : await client.query(
          `insert into icamp_private.verified_guest_feedback
       (organization_id,campground_id,reservation_id,guest_user_id,rating,category,title,public_summary,
        private_details,public_requested,assistance_case_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
          [organizationId, campgroundId, reservationId, userId, ...values],
        );
    const feedback = saved.rows[0];
    const eventKind =
      before?.public_requested && !normalized.publicRequested
        ? "consent_withdrawn"
        : before
          ? "edited"
          : "submitted";
    await appendModerationEvent(client, feedback, userId, eventKind);
    await audit(client, {
      actorUserId: userId,
      actorSessionId,
      organizationId,
      campgroundId,
      subjectId: feedback.id,
      actionKey: "guest_feedback.saved",
      beforeState: before
        ? {
            publicRequested: before.public_requested,
            version: Number(before.row_version),
          }
        : null,
      afterState: {
        rating: feedback.rating,
        publicRequested: feedback.public_requested,
        moderation: "pending",
        version: Number(feedback.row_version),
      },
    });
    return feedback.id;
  });
}

async function ownLocked(client, userId, feedbackId) {
  const result = await client.query(
    `select * from icamp_private.verified_guest_feedback where id=$1 and guest_user_id=$2 for update`,
    [feedbackId, userId],
  );
  if (result.rowCount !== 1)
    throw new Error("Your feedback record was not found.");
  return result.rows[0];
}

export async function withdrawFeedbackPublication({
  userId,
  actorSessionId,
  feedbackId,
}) {
  feedbackUuid(feedbackId, "Feedback");
  return transaction(async (client) => {
    await requireGuest(client, userId);
    const before = await ownLocked(client, userId, feedbackId);
    if (!before.public_requested) return;
    await client.query(
      `update icamp_private.verified_guest_feedback
       set public_requested=false,moderation_state='pending',moderation_reason=null,
         moderated_by_user_id=null,moderated_at=null,appeal_pending=false,appeal_reason=null,appeal_requested_at=null
       where id=$1`,
      [feedbackId],
    );
    await appendModerationEvent(client, before, userId, "consent_withdrawn");
    await audit(client, {
      actorUserId: userId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId: before.campground_id,
      subjectId: feedbackId,
      actionKey: "guest_feedback.public_consent_withdrawn",
      beforeState: { publicRequested: true },
      afterState: { publicRequested: false, moderation: "pending" },
    });
  });
}

export async function appealFeedbackModeration({
  userId,
  actorSessionId,
  feedbackId,
  reason,
}) {
  feedbackUuid(feedbackId, "Feedback");
  const appeal = normalizeFeedbackAppeal(reason);
  return transaction(async (client) => {
    await requireGuest(client, userId);
    const before = await ownLocked(client, userId, feedbackId);
    if (
      !before.public_requested ||
      before.moderation_state !== "declined" ||
      before.appeal_pending
    )
      throw new Error(
        "Only a declined, publication-requested review can be appealed.",
      );
    await client.query(
      `update icamp_private.verified_guest_feedback
       set appeal_pending=true,appeal_reason=$2,appeal_requested_at=statement_timestamp()
       where id=$1`,
      [feedbackId, appeal],
    );
    await appendModerationEvent(
      client,
      before,
      userId,
      "appealed",
      "Appeal requested by verified guest",
    );
    await audit(client, {
      actorUserId: userId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId: before.campground_id,
      subjectId: feedbackId,
      actionKey: "guest_feedback.appeal_requested",
      afterState: { appealPending: true },
    });
  });
}

export async function listManagedGuestFeedback({ userId, campgroundId }) {
  await requireManager(userId, campgroundId);
  return transaction(async (client) => {
    const result = await client.query(
      `${OWN_REVIEW_SELECT} where f.campground_id=$1 order by f.updated_at desc,f.id limit 100`,
      [campgroundId],
    );
    return withHistory(client, result.rows.map(mapReview));
  });
}

export async function moderateGuestFeedback({
  actorUserId,
  actorSessionId,
  campgroundId,
  feedbackId,
  expectedRowVersion,
  input,
}) {
  await requireManager(actorUserId, campgroundId);
  feedbackUuid(feedbackId, "Feedback");
  const { decision, reason } = normalizeFeedbackDecision(input);
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 1)
    throw new Error("Feedback version is invalid.");
  return transaction(async (client) => {
    const result = await client.query(
      `select * from icamp_private.verified_guest_feedback where id=$1 and campground_id=$2 for update`,
      [feedbackId, campgroundId],
    );
    const before = result.rows[0];
    if (!before || Number(before.row_version) !== expectedRowVersion)
      throw new Error("Feedback changed; refresh its current decision state.");
    if (
      !before.public_requested ||
      (!before.appeal_pending && before.moderation_state !== "pending")
    )
      throw new Error(
        "A guest publication request or pending appeal is required.",
      );
    await client.query(
      `update icamp_private.verified_guest_feedback
       set moderation_state=$2,moderation_reason=$3,moderated_by_user_id=$4,
         moderated_at=statement_timestamp(),appeal_pending=false,appeal_reason=null,appeal_requested_at=null
       where id=$1`,
      [feedbackId, decision, reason || null, actorUserId],
    );
    await appendModerationEvent(
      client,
      before,
      actorUserId,
      before.appeal_pending ? `appeal_${decision}` : decision,
      reason,
    );
    await audit(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId,
      subjectId: feedbackId,
      actionKey: "guest_feedback.moderated",
      manager: true,
      beforeState: {
        moderation: before.moderation_state,
        appeal: before.appeal_pending,
      },
      afterState: {
        moderation: decision,
        publicRequested: true,
        appeal: false,
      },
    });
  });
}

export async function recordGuestFeedbackRecovery({
  actorUserId,
  actorSessionId,
  campgroundId,
  feedbackId,
  expectedRowVersion,
  input,
}) {
  await requireManager(actorUserId, campgroundId);
  feedbackUuid(feedbackId, "Feedback");
  const normalized = normalizeFeedbackRecovery(input);
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 1)
    throw new Error("Feedback version is invalid.");
  return transaction(async (client) => {
    const result = await client.query(
      `select f.*, (statement_timestamp() at time zone c.timezone)::date local_date
       from icamp_private.verified_guest_feedback f join public.campgrounds c on c.id=f.campground_id
       where f.id=$1 and f.campground_id=$2 for update of f`,
      [feedbackId, campgroundId],
    );
    const before = result.rows[0];
    if (!before || Number(before.row_version) !== expectedRowVersion)
      throw new Error("Feedback changed; refresh its recovery state.");
    const localDate = day(before.local_date);
    if (normalized.dueDate) {
      const maxDate = new Date(`${localDate}T00:00:00.000Z`);
      maxDate.setUTCDate(maxDate.getUTCDate() + 60);
      if (
        normalized.dueDate < localDate ||
        normalized.dueDate > maxDate.toISOString().slice(0, 10)
      )
        throw new Error(
          "A provisional follow-up date must be within the next 60 local days.",
        );
    }
    await client.query(
      `update icamp_private.verified_guest_feedback
       set recovery_stage=$2,recovery_owner_user_id=$3,recovery_due_date=$4,
         recovery_updated_at=statement_timestamp() where id=$1`,
      [feedbackId, normalized.stage, actorUserId, normalized.dueDate],
    );
    await client.query(
      `insert into icamp_private.guest_feedback_recovery_events
       (organization_id,campground_id,feedback_id,actor_user_id,recovery_stage,guest_visible_summary,internal_note,due_date)
       values($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        before.organization_id,
        campgroundId,
        feedbackId,
        actorUserId,
        normalized.stage,
        normalized.guestVisibleSummary,
        normalized.internalNote,
        normalized.dueDate,
      ],
    );
    await audit(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId,
      subjectId: feedbackId,
      actionKey: "guest_feedback.recovery_updated",
      manager: true,
      beforeState: { stage: before.recovery_stage },
      afterState: {
        stage: normalized.stage,
        provisionalDueDate: normalized.dueDate,
        canonicalAssistanceCaseChanged: false,
      },
    });
  });
}
