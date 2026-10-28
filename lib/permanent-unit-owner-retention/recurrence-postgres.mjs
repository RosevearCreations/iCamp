import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  normalizeRecurrenceReview,
  normalizeRecurrenceDecision,
  normalizeIndependentReassessment,
  classifyRecurrenceFollowUp,
  normalizeEvidenceGapAction,
  classifyEvidenceGap,
  normalizeReconciliationExceptionReview,
  normalizeIndependentClosureRecheck,
  normalizeClosureOwnerDecision,
  classifyClosureOwnerDecision,
  normalizeIndependentClosureFollowupReview,
  classifyIndependentClosureFollowup,
  normalizeOwnerFollowupHandoffDecision,
  classifyIndependentOutcomeAging,
  normalizeHandoffIndependentClosureAudit,
  classifyHandoffIndependentClosureStatus,
  normalizeClosureAuditOwnerSignoff,
  classifyClosureAuditOwnerSignoff,
  normalizeOwnerSignoffIndependentCloseout,
  classifyOwnerSignoffFollowup,
  normalizeIndependentCloseoutOwnerOutcome,
  classifyIndependentCloseoutOutcomeAging,
  normalizeOwnerEvidenceIndependentDisposition,
  classifyOwnerEvidenceRenewalDisposition,
  normalizeIndependentDispositionRecheck,
  classifyIndependentDispositionRecheckAging,
  normalizeIndependentRecheckOwnerDecision,
  classifyOwnerReplayGapAging,
  normalizeIndependentProofContinuityReview,
  classifyOwnerProofContinuityAging,
  normalizeClosureRecurrenceEvent,
  classifyClosureRecurrenceStatus,
  normalizeReopenedExceptionAgingReview,
  classifyReopenedExceptionAgingStatus,
  normalizeContinuityResolutionFollowup,
  classifyContinuityResolutionStatus,
  normalizeVerifiedClosureMonitor,
  classifyVerifiedClosureMonitorStatus,
  normalizeReopeningFollowupOversight,
  classifyReopeningFollowupStatus,
  normalizeEscalationResolutionRenewal,
  classifyEscalationResolutionRenewalStatus,
  normalizeRenewalFreshnessDecision,
  classifyRenewalFreshnessDecisionStatus,
} from "./recurrence-core.mjs";
let pool;
function db() {
  if (!process.env.DATABASE_URL?.trim())
    throw new Error("DATABASE_URL is required for recurrence audits.");
  return (pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  }));
}
async function authorize(actor, source, target) {
  const grants = await Promise.all(
    [source, target].map((id) => getCampgroundAuthorization(actor, id)),
  );
  if (
    source === target ||
    grants.some(
      (g) =>
        !g?.roleCodes?.includes("owner_admin") ||
        !g.permissions?.includes("permanent_unit.transfer"),
    )
  )
    throw new Error(
      "Owner / Administrator finance permission to both campgrounds is required.",
    );
}
async function transact(actor, readOnly, work) {
  const client = await db().connect();
  try {
    await client.query(readOnly ? "begin read only" : "begin");
    await client.query("set local role icamp_app");
    await client.query("set local time zone 'UTC'");
    await client.query("set local statement_timeout = '15000ms'");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
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
export async function getRecurrenceLedger(actor, source, target) {
  await authorize(actor, source, target);
  return transact(actor, true, async (client) => {
    const [
      acceptances,
      reviews,
      decisions,
      reassessments,
      ownerActions,
      exceptionReviews,
      closureRechecks,
      closureOwnerDecisions,
      closureFollowupReviews,
      closureHandoffDecisions,
      handoffIndependentAudits,
      closureAuditOwnerSignoffs,
      signoffIndependentCloseoutReviews,
      independentCloseoutOwnerOutcomes,
      ownerEvidenceIndependentDispositions,
      independentDispositionRechecks,
      independentRecheckOwnerDecisions,
      independentProofContinuityReviews,
      closureRecurrenceEvents,
      reopenedExceptionAgingReviews,
      continuityResolutionFollowups,
      verifiedClosureMonitors,
      reopeningFollowupOversights,
      escalationResolutionRenewals,
      renewalFreshnessDecisions,
    ] = await Promise.all([
      client.query(
        `select a.id,a.accepted_at from public.owner_export_outcome_acceptances a where a.source_campground_id=$1 and a.target_campground_id=$2 and a.acceptance_kind='accepted' order by a.accepted_at desc,a.id desc limit 101`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_hold_recurrence_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_hold_recurrence_decisions where source_campground_id=$1 and target_campground_id=$2 order by decided_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_recurrence_reassessments where source_campground_id=$1 and target_campground_id=$2 order by assessed_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_reassessment_owner_actions where source_campground_id=$1 and target_campground_id=$2 order by acted_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_reconciliation_exception_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_reconciliation_closure_rechecks where source_campground_id=$1 and target_campground_id=$2 order by rechecked_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_closure_owner_decisions where source_campground_id=$1 and target_campground_id=$2 order by decided_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_closure_followup_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_independent_followup_owner_decisions where source_campground_id=$1 and target_campground_id=$2 order by acted_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_handoff_independent_closure_audits where source_campground_id=$1 and target_campground_id=$2 order by audited_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_closure_audit_owner_signoffs where source_campground_id=$1 and target_campground_id=$2 order by signed_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_signoff_independent_closeout_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_independent_closeout_owner_outcomes where source_campground_id=$1 and target_campground_id=$2 order by recorded_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_owner_evidence_independent_dispositions where source_campground_id=$1 and target_campground_id=$2 order by dispositioned_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_independent_disposition_rechecks where source_campground_id=$1 and target_campground_id=$2 order by rechecked_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_independent_recheck_owner_decisions where source_campground_id=$1 and target_campground_id=$2 order by recorded_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_owner_decision_independent_continuity_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_closure_recurrence_events where source_campground_id=$1 and target_campground_id=$2 order by recorded_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_reopened_exception_aging_reviews where source_campground_id=$1 and target_campground_id=$2 order by recorded_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_continuity_resolution_followups where source_campground_id=$1 and target_campground_id=$2 order by recorded_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_verified_closure_monitors where source_campground_id=$1 and target_campground_id=$2 order by recorded_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_reopening_followup_oversights where source_campground_id=$1 and target_campground_id=$2 order by recorded_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_escalation_resolution_renewals where source_campground_id=$1 and target_campground_id=$2 order by recorded_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_renewal_freshness_decisions where source_campground_id=$1 and target_campground_id=$2 order by recorded_at desc,id desc limit 301`,
        [source, target],
      ),
    ]);
    const reassessmentByDecision = new Map(
      reassessments.rows.map((r) => [r.recurrence_decision_id, r.id]),
    );
    const actionByReassessment = new Map();
    for (const action of ownerActions.rows) {
      if (!actionByReassessment.has(action.reassessment_id))
        actionByReassessment.set(action.reassessment_id, action);
    }
    const ownerDecisionByRecheck = new Map(
      closureOwnerDecisions.rows.map((d) => [d.closure_recheck_id, d]),
    );
    const independentReviewByDecision = new Map(
      closureFollowupReviews.rows.map((r) => [r.owner_decision_id, r]),
    );
    const ownerHandoffByReview = new Map(
      closureHandoffDecisions.rows.map((d) => [d.independent_review_id, d]),
    );
    const independentAuditByHandoff = new Map(
      handoffIndependentAudits.rows.map((a) => [a.handoff_decision_id, a]),
    );
    const signoffByAudit = new Map(
      closureAuditOwnerSignoffs.rows.map((s) => [s.independent_audit_id, s]),
    );
    const closeoutReviewBySignoff = new Map(
      signoffIndependentCloseoutReviews.rows.map((r) => [
        r.owner_signoff_id,
        r,
      ]),
    );
    const ownerOutcomeByCloseout = new Map(
      independentCloseoutOwnerOutcomes.rows.map((o) => [
        o.closeout_review_id,
        o,
      ]),
    );
    const independentDispositionByOwnerOutcome = new Map(
      ownerEvidenceIndependentDispositions.rows.map((d) => [
        d.owner_outcome_id,
        d,
      ]),
    );
    const recheckByIndependentDisposition = new Map(
      independentDispositionRechecks.rows.map((r) => [
        r.independent_disposition_id,
        r,
      ]),
    );
    const ownerDecisionByIndependentRecheck = new Map(
      independentRecheckOwnerDecisions.rows.map((d) => [
        d.independent_recheck_id,
        d,
      ]),
    );
    const proofReviewByOwnerDecision = new Map(
      independentProofContinuityReviews.rows.map((r) => [
        r.owner_decision_id,
        r,
      ]),
    );
    const nextRecurrenceByPrior = new Map(
      closureRecurrenceEvents.rows.map((e) => [e.prior_event_id, e]),
    );
    const nextAgingReviewByPrior = new Map(
      reopenedExceptionAgingReviews.rows.map((r) => [r.prior_review_id, r]),
    );
    const nextResolutionByPrior = new Map(
      continuityResolutionFollowups.rows.map((r) => [r.prior_followup_id, r]),
    );
    const nextVerifiedMonitorByPrior = new Map(
      verifiedClosureMonitors.rows.map((r) => [r.prior_monitor_id, r]),
    );
    const nextReopeningOversightByPrior = new Map(
      reopeningFollowupOversights.rows.map((r) => [r.prior_oversight_id, r]),
    );
    const nextEscalationRenewalByPrior = new Map(
      escalationResolutionRenewals.rows.map((r) => [r.prior_renewal_id, r]),
    );
    const nextFreshnessDecisionByPrior = new Map(
      renewalFreshnessDecisions.rows.map((r) => [r.prior_audit_id, r]),
    );
    return {
      acceptances: acceptances.rows.slice(0, 100),
      reviews: reviews.rows.slice(0, 150),
      decisions: decisions.rows.slice(0, 150).map((d) => ({
        ...d,
        reassessment_id: reassessmentByDecision.get(d.id) ?? null,
        followup_status: classifyRecurrenceFollowUp({
          ...d,
          reassessment_id: reassessmentByDecision.get(d.id) ?? null,
        }),
      })),
      reassessments: reassessments.rows.slice(0, 150).map((r) => ({
        ...r,
        gap_status: classifyEvidenceGap(
          r,
          actionByReassessment.get(r.id) ?? null,
        ),
      })),
      ownerActions: ownerActions.rows.slice(0, 300),
      exceptionReviews: exceptionReviews.rows.slice(0, 150),
      closureRechecks: closureRechecks.rows.slice(0, 150).map((r) => ({
        ...r,
        owner_decision_status: classifyClosureOwnerDecision(
          r,
          ownerDecisionByRecheck.get(r.id) ?? null,
        ),
      })),
      closureOwnerDecisions: closureOwnerDecisions.rows
        .slice(0, 150)
        .map((d) => ({
          ...d,
          independent_followup_status: classifyIndependentClosureFollowup(
            d,
            independentReviewByDecision.get(d.id) ?? null,
          ),
        })),
      closureFollowupReviews: closureFollowupReviews.rows
        .slice(0, 150)
        .map((r) => ({
          ...r,
          owner_reconciliation_status: classifyIndependentOutcomeAging(
            r,
            ownerHandoffByReview.get(r.id) ?? null,
          ),
        })),
      closureHandoffDecisions: closureHandoffDecisions.rows
        .slice(0, 150)
        .map((d) => ({
          ...d,
          independent_audit_status: classifyHandoffIndependentClosureStatus(
            d,
            independentAuditByHandoff.get(d.id) ?? null,
          ),
        })),
      handoffIndependentAudits: handoffIndependentAudits.rows
        .slice(0, 150)
        .map((a) => ({
          ...a,
          owner_signoff_status: classifyClosureAuditOwnerSignoff(
            a,
            signoffByAudit.get(a.id) ?? null,
          ),
        })),
      closureAuditOwnerSignoffs: closureAuditOwnerSignoffs.rows
        .slice(0, 150)
        .map((s) => ({
          ...s,
          independent_closeout_status: classifyOwnerSignoffFollowup(
            s,
            closeoutReviewBySignoff.get(s.id) ?? null,
          ),
        })),
      signoffIndependentCloseoutReviews: signoffIndependentCloseoutReviews.rows
        .slice(0, 150)
        .map((r) => ({
          ...r,
          owner_outcome_status: classifyIndependentCloseoutOutcomeAging(
            r,
            ownerOutcomeByCloseout.get(r.id) ?? null,
          ),
        })),
      independentCloseoutOwnerOutcomes: independentCloseoutOwnerOutcomes.rows
        .slice(0, 150)
        .map((o) => ({
          ...o,
          independent_disposition_status:
            classifyOwnerEvidenceRenewalDisposition(
              o,
              independentDispositionByOwnerOutcome.get(o.id) ?? null,
            ),
        })),
      ownerEvidenceIndependentDispositions:
        ownerEvidenceIndependentDispositions.rows.slice(0, 150).map((d) => ({
          ...d,
          independent_recheck_status:
            classifyIndependentDispositionRecheckAging(
              d,
              recheckByIndependentDisposition.get(d.id) ?? null,
            ),
        })),
      independentDispositionRechecks: independentDispositionRechecks.rows
        .slice(0, 150)
        .map((r) => ({
          ...r,
          owner_gap_status: classifyOwnerReplayGapAging(
            r,
            ownerDecisionByIndependentRecheck.get(r.id) ?? null,
          ),
        })),
      independentRecheckOwnerDecisions: independentRecheckOwnerDecisions.rows
        .slice(0, 150)
        .map((d) => ({
          ...d,
          proof_continuity_status: classifyOwnerProofContinuityAging(
            d,
            proofReviewByOwnerDecision.get(d.id) ?? null,
          ),
        })),
      independentProofContinuityReviews:
        independentProofContinuityReviews.rows.slice(0, 150),
      closureRecurrenceEvents: closureRecurrenceEvents.rows
        .slice(0, 300)
        .map((e) => ({
          ...e,
          recurrence_status: classifyClosureRecurrenceStatus(
            e,
            nextRecurrenceByPrior.get(e.id) ?? null,
          ),
        })),
      reopenedExceptionAgingReviews: reopenedExceptionAgingReviews.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          aging_status: classifyReopenedExceptionAgingStatus(
            r,
            nextAgingReviewByPrior.get(r.id) ?? null,
          ),
        })),
      continuityResolutionFollowups: continuityResolutionFollowups.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          resolution_status: classifyContinuityResolutionStatus(
            r,
            nextResolutionByPrior.get(r.id) ?? null,
          ),
        })),
      verifiedClosureMonitors: verifiedClosureMonitors.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          monitoring_status: classifyVerifiedClosureMonitorStatus(
            r,
            nextVerifiedMonitorByPrior.get(r.id) ?? null,
          ),
        })),
      reopeningFollowupOversights: reopeningFollowupOversights.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          oversight_status: classifyReopeningFollowupStatus(
            r,
            nextReopeningOversightByPrior.get(r.id) ?? null,
          ),
        })),
      escalationResolutionRenewals: escalationResolutionRenewals.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          renewal_status: classifyEscalationResolutionRenewalStatus(
            r,
            nextEscalationRenewalByPrior.get(r.id) ?? null,
          ),
        })),
      renewalFreshnessDecisions: renewalFreshnessDecisions.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          audit_status: classifyRenewalFreshnessDecisionStatus(
            r,
            nextFreshnessDecisionByPrior.get(r.id) ?? null,
          ),
        })),
      limited:
        acceptances.rows.length > 100 ||
        reviews.rows.length > 150 ||
        decisions.rows.length > 150 ||
        reassessments.rows.length > 150 ||
        ownerActions.rows.length > 300 ||
        exceptionReviews.rows.length > 150 ||
        closureRechecks.rows.length > 150 ||
        closureOwnerDecisions.rows.length > 150 ||
        closureFollowupReviews.rows.length > 150 ||
        closureHandoffDecisions.rows.length > 150 ||
        handoffIndependentAudits.rows.length > 150 ||
        closureAuditOwnerSignoffs.rows.length > 150 ||
        signoffIndependentCloseoutReviews.rows.length > 150 ||
        independentCloseoutOwnerOutcomes.rows.length > 150 ||
        ownerEvidenceIndependentDispositions.rows.length > 150 ||
        independentDispositionRechecks.rows.length > 150 ||
        independentRecheckOwnerDecisions.rows.length > 150 ||
        independentProofContinuityReviews.rows.length > 150 ||
        closureRecurrenceEvents.rows.length > 300 ||
        reopenedExceptionAgingReviews.rows.length > 300 ||
        continuityResolutionFollowups.rows.length > 300 ||
        verifiedClosureMonitors.rows.length > 300 ||
        reopeningFollowupOversights.rows.length > 300 ||
        escalationResolutionRenewals.rows.length > 300 ||
        renewalFreshnessDecisions.rows.length > 300,
    };
  });
}
export async function recordReopeningFollowupOversight({
  actorUserId,
  ...raw
}) {
  const v = normalizeReopeningFollowupOversight(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_reopening_followup_oversights(id,verified_monitor_id,prior_oversight_id,verified_resolution_event_id,source_campground_id,target_campground_id,oversight_kind,outcome_kind,next_due_at,evidence_reference,oversight_note,recorded_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,observed_reopen_age_days,observed_prior_days_overdue,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_recent_owner_escalations,observed_verified_resolution_linked`,
      [
        v.id,
        v.verifiedMonitorId,
        v.priorOversightId,
        v.verifiedResolutionEventId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.oversightKind,
        v.outcomeKind,
        v.nextDueAt,
        v.evidenceReference,
        v.oversightNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordEscalationResolutionRenewal({
  actorUserId,
  ...raw
}) {
  const v = normalizeEscalationResolutionRenewal(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_escalation_resolution_renewals(id,resolved_oversight_id,prior_renewal_id,renewal_evidence_event_id,source_campground_id,target_campground_id,renewal_kind,outcome_kind,next_due_at,evidence_reference,renewal_note,recorded_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,observed_resolution_age_days,observed_prior_days_overdue,observed_new_reopenings,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_recent_owner_escalations,observed_fresh_renewal_verified`,
      [
        v.id,
        v.resolvedOversightId,
        v.priorRenewalId,
        v.renewalEvidenceEventId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.renewalKind,
        v.outcomeKind,
        v.nextDueAt,
        v.evidenceReference,
        v.renewalNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordRenewalFreshnessDecision({ actorUserId, ...raw }) {
  const v = normalizeRenewalFreshnessDecision(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_renewal_freshness_decisions(id,owner_renewal_id,prior_audit_id,comparison_evidence_event_id,source_campground_id,target_campground_id,audit_kind,outcome_kind,next_due_at,evidence_reference,audit_note,recorded_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,observed_proof_age_days,observed_prior_days_overdue,observed_new_reopenings,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_recent_owner_escalations,observed_fresh_source_verified`,
      [
        v.id,
        v.ownerRenewalId,
        v.priorAuditId,
        v.comparisonEvidenceEventId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.auditKind,
        v.outcomeKind,
        v.nextDueAt,
        v.evidenceReference,
        v.auditNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordVerifiedClosureMonitor({ actorUserId, ...raw }) {
  const v = normalizeVerifiedClosureMonitor(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_verified_closure_monitors(id,closure_followup_id,prior_monitor_id,linked_reopen_event_id,source_campground_id,target_campground_id,monitor_kind,outcome_kind,next_due_at,evidence_reference,monitor_note,recorded_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,observed_proof_age_days,observed_prior_days_overdue,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_recent_owner_escalations,observed_original_verified_closure,observed_linked_reopening_verified`,
      [
        v.id,
        v.closureFollowupId,
        v.priorMonitorId,
        v.linkedReopenEventId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.monitorKind,
        v.outcomeKind,
        v.nextDueAt,
        v.evidenceReference,
        v.monitorNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
export async function recordContinuityResolutionFollowup({
  actorUserId,
  ...raw
}) {
  const v = normalizeContinuityResolutionFollowup(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_continuity_resolution_followups(id,aging_review_id,prior_followup_id,verified_followup_event_id,source_campground_id,target_campground_id,followup_kind,outcome_kind,next_due_at,evidence_reference,followup_note,recorded_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,observed_prior_days_overdue,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_recent_owner_escalations,observed_verified_followup_linked`,
      [
        v.id,
        v.agingReviewId,
        v.priorFollowupId,
        v.verifiedFollowupEventId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.followupKind,
        v.outcomeKind,
        v.nextDueAt,
        v.evidenceReference,
        v.followupNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
export async function recordReopenedExceptionAgingReview({
  actorUserId,
  ...raw
}) {
  const v = normalizeReopenedExceptionAgingReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_reopened_exception_aging_reviews(id,reopen_event_id,prior_review_id,verified_followup_event_id,source_campground_id,target_campground_id,review_kind,outcome_kind,next_due_at,evidence_reference,review_note,recorded_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,observed_reopen_days_aging,observed_prior_days_overdue,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_recent_owner_escalations,observed_verified_followup_linked`,
      [
        v.id,
        v.reopenEventId,
        v.priorReviewId,
        v.verifiedFollowupEventId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.reviewKind,
        v.outcomeKind,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
export async function recordClosureRecurrenceEvent({ actorUserId, ...raw }) {
  const v = normalizeClosureRecurrenceEvent(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_closure_recurrence_events(id,proof_review_id,prior_event_id,source_campground_id,target_campground_id,event_kind,outcome_kind,owner_evidence_decision_id,next_due_at,evidence_reference,event_note,recorded_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,observed_prior_days_overdue,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_recent_owner_escalations,observed_original_proof_verified`,
      [
        v.id,
        v.proofReviewId,
        v.priorEventId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.eventKind,
        v.outcomeKind,
        v.ownerEvidenceDecisionId,
        v.nextDueAt,
        v.evidenceReference,
        v.eventNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
export async function recordIndependentProofContinuityReview({
  actorUserId,
  ...raw
}) {
  const v = normalizeIndependentProofContinuityReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_owner_decision_independent_continuity_reviews(id,owner_decision_id,replay_owner_decision_id,source_campground_id,target_campground_id,review_kind,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id,observed_owner_days_overdue,observed_peer_open_owner_decisions,observed_peer_overdue_owner_decisions,observed_recent_escalation_renewals,observed_open_independent_rechecks,observed_replay_is_newer,observed_prior_chain_complete`,
      [
        v.id,
        v.ownerDecisionId,
        v.replayOwnerDecisionId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.reviewKind,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordIndependentRecheckOwnerDecision({
  actorUserId,
  ...raw
}) {
  const v = normalizeIndependentRecheckOwnerDecision(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_independent_recheck_owner_decisions(id,independent_recheck_id,source_campground_id,target_campground_id,decision_kind,next_due_at,evidence_reference,decision_note,recorded_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,observed_recheck_days_overdue,observed_peer_open_rechecks,observed_peer_overdue_rechecks,observed_prior_escalation_decisions,observed_recent_independent_escalations,observed_replay_is_newer,observed_closure_proof_chain_complete`,
      [
        v.id,
        v.independentRecheckId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.decisionKind,
        v.nextDueAt,
        v.evidenceReference,
        v.decisionNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordIndependentDispositionRecheck({
  actorUserId,
  ...raw
}) {
  const v = normalizeIndependentDispositionRecheck(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_independent_disposition_rechecks(id,independent_disposition_id,replay_owner_outcome_id,source_campground_id,target_campground_id,recheck_kind,next_due_at,evidence_reference,recheck_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id,observed_disposition_days_overdue,observed_peer_pending_dispositions,observed_peer_overdue_dispositions,observed_recent_escalation_rechecks,observed_recent_owner_renewals,observed_replay_is_newer`,
      [
        v.id,
        v.independentDispositionId,
        v.replayOwnerOutcomeId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.recheckKind,
        v.nextDueAt,
        v.evidenceReference,
        v.recheckNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordOwnerEvidenceIndependentDisposition({
  actorUserId,
  ...raw
}) {
  const v = normalizeOwnerEvidenceIndependentDisposition(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_owner_evidence_independent_dispositions(id,owner_outcome_id,source_campground_id,target_campground_id,disposition_kind,next_due_at,evidence_reference,disposition_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,observed_owner_days_overdue,observed_peer_pending_outcomes,observed_peer_overdue_outcomes,observed_recent_owner_renewals,observed_recent_independent_escalations`,
      [
        v.id,
        v.ownerOutcomeId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.dispositionKind,
        v.nextDueAt,
        v.evidenceReference,
        v.dispositionNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordIndependentCloseoutOwnerOutcome({
  actorUserId,
  ...raw
}) {
  const v = normalizeIndependentCloseoutOwnerOutcome(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_independent_closeout_owner_outcomes(id,closeout_review_id,source_campground_id,target_campground_id,outcome_kind,next_due_at,evidence_reference,outcome_note,recorded_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,observed_review_days_overdue,observed_peer_open_reviews,observed_peer_overdue_reviews,observed_prior_independent_escalations,observed_prior_exception_renewals`,
      [
        v.id,
        v.closeoutReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.outcomeKind,
        v.nextDueAt,
        v.evidenceReference,
        v.outcomeNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordOwnerSignoffIndependentCloseout({
  actorUserId,
  ...raw
}) {
  const v = normalizeOwnerSignoffIndependentCloseout(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_signoff_independent_closeout_reviews(id,owner_signoff_id,source_campground_id,target_campground_id,review_kind,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,observed_signoff_days_overdue,observed_peer_open_signoffs,observed_peer_overdue_signoffs,observed_prior_escalation_acceptances,observed_prior_evidence_refreshes`,
      [
        v.id,
        v.ownerSignoffId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.reviewKind,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordClosureAuditOwnerSignoff({ actorUserId, ...raw }) {
  const v = normalizeClosureAuditOwnerSignoff(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_closure_audit_owner_signoffs(id,independent_audit_id,source_campground_id,target_campground_id,signoff_kind,next_due_at,evidence_reference,signoff_note,signed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,observed_reassessment_days_overdue,observed_peer_open_audits,observed_peer_overdue_audits,observed_prior_manual_escalations`,
      [
        v.id,
        v.independentAuditId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.signoffKind,
        v.nextDueAt,
        v.evidenceReference,
        v.signoffNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordHandoffIndependentClosureAudit({
  actorUserId,
  ...raw
}) {
  const v = normalizeHandoffIndependentClosureAudit(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_handoff_independent_closure_audits(id,handoff_decision_id,source_campground_id,target_campground_id,audit_kind,next_due_at,evidence_reference,audit_note,audited_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,observed_handoff_days_overdue,observed_other_open_handoffs,observed_other_overdue_handoffs,observed_other_escalation_handoffs`,
      [
        v.id,
        v.handoffDecisionId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.auditKind,
        v.nextDueAt,
        v.evidenceReference,
        v.auditNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordOwnerIndependentHandoffDecision({
  actorUserId,
  ...raw
}) {
  const v = normalizeOwnerFollowupHandoffDecision(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_independent_followup_owner_decisions(id,independent_review_id,source_campground_id,target_campground_id,action_kind,next_due_at,evidence_reference,action_note,acted_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,observed_review_days_overdue,observed_peer_overdue_reviews,observed_prior_escalation_handoffs`,
      [
        v.id,
        v.independentReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.actionKind,
        v.nextDueAt,
        v.evidenceReference,
        v.actionNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordIndependentClosureFollowupReview({
  actorUserId,
  ...raw
}) {
  const v = normalizeIndependentClosureFollowupReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_closure_followup_reviews(id,owner_decision_id,source_campground_id,target_campground_id,review_kind,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,observed_recurring_decisions,observed_overdue_decisions,observed_escalation_decisions,observed_owner_days_overdue`,
      [
        v.id,
        v.ownerDecisionId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.reviewKind,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordClosureOwnerDecision({ actorUserId, ...raw }) {
  const v = normalizeClosureOwnerDecision(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_closure_owner_decisions(id,closure_recheck_id,source_campground_id,target_campground_id,decision_kind,next_due_at,evidence_reference,decision_note,decided_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        v.id,
        v.closureRecheckId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.decisionKind,
        v.nextDueAt,
        v.evidenceReference,
        v.decisionNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
export async function recordReconciliationExceptionReview({
  actorUserId,
  ...raw
}) {
  const v = normalizeReconciliationExceptionReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_reconciliation_exception_reviews(id,owner_action_id,source_campground_id,target_campground_id,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7) returning id,observed_open_gaps,observed_overdue_gaps,observed_recurrence_count`,
      [
        v.id,
        v.ownerActionId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
export async function recordIndependentClosureRecheck({ actorUserId, ...raw }) {
  const v = normalizeIndependentClosureRecheck(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_reconciliation_closure_rechecks(id,exception_review_id,source_campground_id,target_campground_id,recheck_kind,evidence_reference,recheck_note,rechecked_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        v.id,
        v.exceptionReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.recheckKind,
        v.evidenceReference,
        v.recheckNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
export async function recordOwnerEvidenceGapAction({ actorUserId, ...raw }) {
  const v = normalizeEvidenceGapAction(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_reassessment_owner_actions(id,reassessment_id,source_campground_id,target_campground_id,action_kind,next_due_at,evidence_reference,action_note,acted_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        v.id,
        v.reassessmentId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.actionKind,
        v.nextDueAt,
        v.evidenceReference,
        v.actionNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordIndependentRecurrenceReassessment({
  actorUserId,
  ...raw
}) {
  const v = normalizeIndependentReassessment(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_recurrence_reassessments(id,recurrence_decision_id,source_campground_id,target_campground_id,assessment_kind,evidence_reference,assessment_note,assessed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        v.id,
        v.recurrenceDecisionId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.assessmentKind,
        v.evidenceReference,
        v.assessmentNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordOwnerRecurrenceReview({ actorUserId, ...raw }) {
  const v = normalizeRecurrenceReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_hold_recurrence_reviews(id,acceptance_id,source_campground_id,target_campground_id,evidence_reference,review_note,reviewed_by_user_id)values($1,$2,$3,$4,$5,$6,$7)returning id,observed_plan_count,observed_continued_holds,observed_overdue_plans`,
      [
        v.id,
        v.acceptanceId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
export async function recordIndependentRecurrenceDecision({
  actorUserId,
  ...raw
}) {
  const v = normalizeRecurrenceDecision(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_hold_recurrence_decisions(id,recurrence_review_id,source_campground_id,target_campground_id,decision_kind,next_due_at,evidence_reference,decision_note,decided_by_user_id)values($1,$2,$3,$4,$5,$6,$7,$8,$9)returning id`,
      [
        v.id,
        v.recurrenceReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.decisionKind,
        v.nextDueAt,
        v.evidenceReference,
        v.decisionNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
