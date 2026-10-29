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
  normalizeContinuityRecurrenceRecheck,
  classifyContinuityRecurrenceRecheckStatus,
  normalizeOwnerRecheckRenewalWatch,
  classifyOwnerRecheckRenewalWatchStatus,
  normalizeContinuityEvidenceReconciliation,
  classifyContinuityEvidenceReconciliationStatus,
  normalizeOwnerProofGatewayReview,
  classifyOwnerProofGatewayReviewStatus,
  normalizeGatewayHoldReceiptReview,
  classifyGatewayHoldReceiptReviewStatus,
  normalizeQl245SourcePinHoldReview,
  classifyQl245SourcePinHoldStatus,
  normalizeQl246ExceptionPinHoldDecision,
  classifyQl246ExceptionPinHoldStatus,
  normalizeQl247TestReceiptHoldWatch,
  classifyQl247TestReceiptHoldStatus,
  normalizeQl248ProvenanceGapHoldRenewal,
  classifyQl248ProvenanceGapHoldStatus,
  normalizeQl248SourceReceiptExceptionReassessment,
  classifyQl248SourceReceiptReassessmentStatus,
  normalizeQl252SourceAuditHoldReview,
  classifyQl252SourceAuditHoldStatus,
  normalizeQl253HoldReview,
  classifyQl253HoldReviewStatus,
  normalizeQl254HoldReview,
  classifyQl254HoldReviewStatus,
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
      continuityRecurrenceRechecks,
      ownerRecheckRenewalWatches,
      continuityEvidenceReconciliations,
      ownerProofGatewayReviews,
      gatewayHoldReceiptReviews,
      sourcePinHoldReviews,
      ql246ExceptionPinHoldDecisions,
      ql247TestReceiptHoldWatches,
      ql248ProvenanceGapHoldRenewals,
      ql248SourceReceiptExceptionReassessments,
      ql252ProofDenialHoldReviews,
      ql253ProofCustodyOwnerHoldReviews,
      ql254OriginalProofRegistryOwnerHoldReviews,
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
      client.query(
        `select * from public.owner_export_continuity_recurrence_audits where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_owner_recheck_renewal_watches where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_continuity_evidence_reconciliations where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_proof_renewal_gate_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_gateway_hold_receipt_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_ql245_source_pin_hold_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_ql246_exception_pin_hold_decisions where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_ql247_test_receipt_hold_watches where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_ql248_provenance_gap_hold_renewals where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_ql248_source_receipt_exception_reassessments where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_ql252_proof_denial_hold_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_ql253_proof_custody_owner_hold_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_ql254_original_proof_registry_owner_hold_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 301`,
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
    const nextContinuityRecheckByPrior = new Map(
      continuityRecurrenceRechecks.rows.map((r) => [r.prior_recheck_id, r]),
    );
    const nextOwnerRecheckRenewalByPrior = new Map(
      ownerRecheckRenewalWatches.rows.map((r) => [r.prior_watch_id, r]),
    );
    const nextEvidenceReconciliationByPrior = new Map(
      continuityEvidenceReconciliations.rows.map((r) => [
        r.prior_reconciliation_id,
        r,
      ]),
    );
    const nextOwnerProofGatewayByPrior = new Map(
      ownerProofGatewayReviews.rows.map((r) => [r.prior_review_id, r]),
    );
    const nextGatewayHoldReceiptByPrior = new Map(
      gatewayHoldReceiptReviews.rows.map((r) => [r.prior_review_id, r]),
    );
    const nextSourcePinHoldByPrior = new Map(
      sourcePinHoldReviews.rows.map((r) => [r.prior_review_id, r]),
    );
    const nextQl246ExceptionByPrior = new Map(
      ql246ExceptionPinHoldDecisions.rows.map((r) => [r.prior_review_id, r]),
    );
    const nextQl247TestByPrior = new Map(
      ql247TestReceiptHoldWatches.rows.map((r) => [r.prior_review_id, r]),
    );
    const nextQl248ReviewByPrior = new Map(
      ql248ProvenanceGapHoldRenewals.rows.map((r) => [r.prior_review_id, r]),
    );
    const nextQl248SourceReceiptByPrior = new Map(
      ql248SourceReceiptExceptionReassessments.rows.map((r) => [
        r.prior_review_id,
        r,
      ]),
    );
    const nextQl252ProofDenialByPrior = new Map(
      ql252ProofDenialHoldReviews.rows.map((r) => [r.prior_review_id, r]),
    );
    const nextQl253ProofCustodyOwnerByPrior = new Map(
      ql253ProofCustodyOwnerHoldReviews.rows.map((r) => [r.prior_review_id, r]),
    );
    const nextQl254ProofRegistryOwnerByPrior = new Map(
      ql254OriginalProofRegistryOwnerHoldReviews.rows.map((r) => [
        r.prior_review_id,
        r,
      ]),
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
      continuityRecurrenceRechecks: continuityRecurrenceRechecks.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          recheck_status: classifyContinuityRecurrenceRecheckStatus(
            r,
            nextContinuityRecheckByPrior.get(r.id) ?? null,
          ),
        })),
      ownerRecheckRenewalWatches: ownerRecheckRenewalWatches.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          watch_status: classifyOwnerRecheckRenewalWatchStatus(
            r,
            nextOwnerRecheckRenewalByPrior.get(r.id) ?? null,
          ),
        })),
      continuityEvidenceReconciliations: continuityEvidenceReconciliations.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          reconciliation_status: classifyContinuityEvidenceReconciliationStatus(
            r,
            nextEvidenceReconciliationByPrior.get(r.id) ?? null,
          ),
        })),
      ownerProofGatewayReviews: ownerProofGatewayReviews.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          review_status: classifyOwnerProofGatewayReviewStatus(
            r,
            nextOwnerProofGatewayByPrior.get(r.id) ?? null,
          ),
        })),
      gatewayHoldReceiptReviews: gatewayHoldReceiptReviews.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          review_status: classifyGatewayHoldReceiptReviewStatus(
            r,
            nextGatewayHoldReceiptByPrior.get(r.id) ?? null,
          ),
        })),
      sourcePinHoldReviews: sourcePinHoldReviews.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          review_status: classifyQl245SourcePinHoldStatus(
            r,
            nextSourcePinHoldByPrior.get(r.id) ?? null,
          ),
        })),
      ql246ExceptionPinHoldDecisions: ql246ExceptionPinHoldDecisions.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          review_status: classifyQl246ExceptionPinHoldStatus(
            r,
            nextQl246ExceptionByPrior.get(r.id) ?? null,
          ),
        })),
      ql247TestReceiptHoldWatches: ql247TestReceiptHoldWatches.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          review_status: classifyQl247TestReceiptHoldStatus(
            r,
            nextQl247TestByPrior.get(r.id) ?? null,
          ),
        })),
      ql248ProvenanceGapHoldRenewals: ql248ProvenanceGapHoldRenewals.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          review_status: classifyQl248ProvenanceGapHoldStatus(
            r,
            nextQl248ReviewByPrior.get(r.id) ?? null,
          ),
        })),
      ql248SourceReceiptExceptionReassessments:
        ql248SourceReceiptExceptionReassessments.rows
          .slice(0, 300)
          .map((r) => ({
            ...r,
            review_status: classifyQl248SourceReceiptReassessmentStatus(
              r,
              nextQl248SourceReceiptByPrior.get(r.id) ?? null,
            ),
          })),
      ql252ProofDenialHoldReviews: ql252ProofDenialHoldReviews.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          review_status: classifyQl252SourceAuditHoldStatus(
            r,
            nextQl252ProofDenialByPrior.get(r.id) ?? null,
          ),
        })),
      ql253ProofCustodyOwnerHoldReviews: ql253ProofCustodyOwnerHoldReviews.rows
        .slice(0, 300)
        .map((r) => ({
          ...r,
          review_status: classifyQl253HoldReviewStatus(
            r,
            nextQl253ProofCustodyOwnerByPrior.get(r.id) ?? null,
          ),
        })),
      ql254OriginalProofRegistryOwnerHoldReviews:
        ql254OriginalProofRegistryOwnerHoldReviews.rows
          .slice(0, 300)
          .map((r) => ({
            ...r,
            review_status: classifyQl254HoldReviewStatus(
              r,
              nextQl254ProofRegistryOwnerByPrior.get(r.id) ?? null,
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
        renewalFreshnessDecisions.rows.length > 300 ||
        continuityRecurrenceRechecks.rows.length > 300 ||
        ownerRecheckRenewalWatches.rows.length > 300 ||
        continuityEvidenceReconciliations.rows.length > 300 ||
        ownerProofGatewayReviews.rows.length > 300 ||
        gatewayHoldReceiptReviews.rows.length > 300 ||
        sourcePinHoldReviews.rows.length > 300 ||
        ql246ExceptionPinHoldDecisions.rows.length > 300 ||
        ql247TestReceiptHoldWatches.rows.length > 300 ||
        ql248ProvenanceGapHoldRenewals.rows.length > 300 ||
        ql248SourceReceiptExceptionReassessments.rows.length > 300 ||
        ql252ProofDenialHoldReviews.rows.length > 300 ||
        ql253ProofCustodyOwnerHoldReviews.rows.length > 300 ||
        ql254OriginalProofRegistryOwnerHoldReviews.rows.length > 300,
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
export async function recordContinuityRecurrenceRecheck({
  actorUserId,
  ...raw
}) {
  const v = normalizeContinuityRecurrenceRecheck(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_continuity_recurrence_audits(id,owner_continuity_id,prior_recheck_id,verified_followup_event_id,source_campground_id,target_campground_id,recheck_kind,outcome_kind,next_due_at,evidence_reference,recheck_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,observed_prior_days_overdue,observed_proof_age_days,observed_new_reopenings,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_recent_owner_escalations,observed_open_renewal_exceptions,observed_overdue_renewal_reviews,observed_verified_owner_proof`,
      [
        v.id,
        v.ownerContinuityId,
        v.priorRecheckId,
        v.verifiedFollowupEventId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.recheckKind,
        v.outcomeKind,
        v.nextDueAt,
        v.evidenceReference,
        v.recheckNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordOwnerRecheckRenewalWatch({ actorUserId, ...raw }) {
  const v = normalizeOwnerRecheckRenewalWatch(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_owner_recheck_renewal_watches(id,owner_recheck_id,prior_watch_id,verified_evidence_event_id,source_campground_id,target_campground_id,watch_kind,outcome_kind,next_due_at,evidence_reference,watch_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,observed_days_since_owner_recheck,observed_prior_days_overdue,observed_evidence_age_days,observed_new_reopenings,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_open_recheck_exceptions,observed_overdue_owner_rechecks,observed_verified_continuity_proof`,
      [
        v.id,
        v.ownerRecheckId,
        v.priorWatchId,
        v.verifiedEvidenceEventId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.watchKind,
        v.outcomeKind,
        v.nextDueAt,
        v.evidenceReference,
        v.watchNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordContinuityEvidenceReconciliation({
  actorUserId,
  ...raw
}) {
  const v = normalizeContinuityEvidenceReconciliation(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_continuity_evidence_reconciliations(id,continuity_watch_id,prior_reconciliation_id,verified_source_event_id,source_campground_id,target_campground_id,review_kind,outcome_kind,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,observed_watch_age_days,observed_prior_overdue_days,observed_proof_age_days,observed_later_reopenings,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_open_renewal_exceptions,observed_overdue_renewal_watches,observed_independent_proof_verified`,
      [
        v.id,
        v.continuityWatchId,
        v.priorReconciliationId,
        v.verifiedSourceEventId,
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
    return result.rows[0];
  });
}
export async function recordOwnerProofGatewayReview({ actorUserId, ...raw }) {
  const v = normalizeOwnerProofGatewayReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_proof_renewal_gate_reviews(id,owner_reconciliation_id,prior_review_id,verified_renewal_event_id,source_campground_id,target_campground_id,review_kind,outcome_kind,next_due_at,gateway_health_receipt_ref,gateway_capabilities_receipt_ref,gateway_audit_receipt_ref,independent_witness_attestation_ref,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id,observed_reconciliation_age_days,observed_prior_overdue_days,observed_proof_age_days,observed_later_reopenings,observed_open_peer_recurrences,observed_open_owner_dispositions,observed_open_139_exceptions,observed_overdue_139_reviews,observed_independent_renewal_proof,observed_gateway_metadata_complete,gate_state,owner_pilot_authorized,dispatch_enabled`,
      [
        v.id,
        v.ownerReconciliationId,
        v.priorReviewId,
        v.verifiedRenewalEventId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.reviewKind,
        v.outcomeKind,
        v.nextDueAt,
        v.gatewayHealthReceiptRef,
        v.gatewayCapabilitiesReceiptRef,
        v.gatewayAuditReceiptRef,
        v.independentWitnessAttestationRef,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordGatewayHoldReceiptReview({ actorUserId, ...raw }) {
  const v = normalizeGatewayHoldReceiptReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_gateway_hold_receipt_reviews(id,gateway_review_id,prior_review_id,source_campground_id,target_campground_id,review_kind,outcome_kind,next_due_at,receipt_kind,receipt_reference,source_revision,ci_run_url,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id,observed_gateway_review_age_days,observed_prior_overdue_days,observed_proof_age_days,observed_open_140_exceptions,observed_overdue_140_leaves,observed_newer_gateway_reviews,receipt_proof_state,connection_state,gate_state,owner_pilot_authorized,dispatch_enabled`,
      [
        v.id,
        v.gatewayReviewId,
        v.priorReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.reviewKind,
        v.outcomeKind,
        v.nextDueAt,
        v.receiptKind,
        v.receiptReference,
        v.sourceRevision,
        v.ciRunUrl,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordQl245SourcePinHoldReview({ actorUserId, ...raw }) {
  const v = normalizeQl245SourcePinHoldReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_ql245_source_pin_hold_reviews(id,receipt_review_id,prior_review_id,source_campground_id,target_campground_id,review_kind,outcome_kind,next_due_at,comparison_source_revision,comparison_ci_run_url,public_source_pin_sha256,separately_sourced_pin_sha256,pin_provenance_ref,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id,observed_base_receipt_age_days,observed_proof_age_days,observed_prior_overdue_days,observed_open_141_exceptions,observed_overdue_141_leaves,observed_newer_same_kind_receipts,observed_source_metadata_match,observed_public_pin_fingerprint_match,source_signature_verified,independently_trusted_pin_verified,connection_state,gate_state,owner_pilot_authorized,dispatch_enabled`,
      [
        v.id,
        v.receiptReviewId,
        v.priorReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.reviewKind,
        v.outcomeKind,
        v.nextDueAt,
        v.comparisonSourceRevision,
        v.comparisonCiRunUrl,
        v.publicSourcePinSha256,
        v.separatelySourcedPinSha256,
        v.pinProvenanceRef,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordQl246ExceptionPinHoldDecision({
  actorUserId,
  ...raw
}) {
  const v = normalizeQl246ExceptionPinHoldDecision(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_ql246_exception_pin_hold_decisions(id,source_pin_review_id,prior_review_id,source_campground_id,target_campground_id,review_kind,outcome_kind,source_system,repository,source_revision,ci_run_url,proof_raw_json_sha256,source_proof_status,public_signer_spki_sha256,out_of_band_spki_sha256,out_of_band_reference,operator_challenge_id,operator_challenge_sha256,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) returning id,source_proof_signature_verified,independent_pin_channel_verified,seven_denials_witnessed,phase_b_test_authorized,owner_pilot_authorized,connection_state,gate_state`,
      [
        v.id,
        v.sourcePinReviewId,
        v.priorReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.reviewKind,
        v.outcomeKind,
        v.sourceSystem,
        v.repository,
        v.sourceRevision,
        v.ciRunUrl,
        v.proofRawJsonSha256,
        v.sourceProofStatus,
        v.publicSignerSpkiSha256,
        v.outOfBandSpkiSha256,
        v.outOfBandReference,
        v.operatorChallengeId,
        v.operatorChallengeSha256,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordQl247TestReceiptHoldWatch({ actorUserId, ...raw }) {
  const v = normalizeQl247TestReceiptHoldWatch(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_ql247_test_receipt_hold_watches(id,ql246_hold_decision_id,prior_review_id,source_campground_id,target_campground_id,source_system,repository,review_kind,outcome_kind,test_authorization_reference,authorization_reference_status,two_sha_agreement_status,two_sha_agreement_reference,source_revision_sha,proof_commit_sha,proof_sha256,ci_run_url,denial_receipt_ids,denial_witness_reference,rollback_reference,revocation_reference,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) returning id,phase_b_test_authorized,seven_denials_independently_witnessed,owner_pilot_authorized,connection_state,gate_state`,
      [
        v.id,
        v.ql246HoldDecisionId,
        v.priorReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.sourceSystem,
        v.repository,
        v.reviewKind,
        v.outcomeKind,
        v.testAuthorizationReference,
        v.authorizationReferenceStatus,
        v.twoShaAgreementStatus,
        v.twoShaAgreementReference,
        v.sourceRevisionSha,
        v.proofCommitSha,
        v.proofSha256,
        v.ciRunUrl,
        v.denialReceiptIds,
        v.denialWitnessReference,
        v.rollbackReference,
        v.revocationReference,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordQl248ProvenanceGapHoldRenewal({
  actorUserId,
  ...raw
}) {
  const v = normalizeQl248ProvenanceGapHoldRenewal(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_ql248_provenance_gap_hold_renewals(id,ql247_watch_id,prior_review_id,source_campground_id,target_campground_id,source_system,repository,review_kind,outcome_kind,proof_public_reference,source_revision_sha,proof_commit_sha,proof_sha256,source_ci_run_url,signer_pin_sha256,signer_pin_reference,consumer_agreement_reference,denial_receipt_ids,denial_witness_reference,owner_test_authorization_reference,rollback_reference,revocation_reference,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) returning id,observed_denial_gap_count,public_source_origin_verified,phase_b_test_authorized,owner_pilot_authorized,connection_state,gate_state`,
      [
        v.id,
        v.ql247WatchId,
        v.priorReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.sourceSystem,
        v.repository,
        v.reviewKind,
        v.outcomeKind,
        v.proofPublicReference,
        v.sourceRevisionSha,
        v.proofCommitSha,
        v.proofSha256,
        v.sourceCiRunUrl,
        v.signerPinSha256,
        v.signerPinReference,
        v.consumerAgreementReference,
        v.denialReceiptIds,
        v.denialWitnessReference,
        v.ownerTestAuthorizationReference,
        v.rollbackReference,
        v.revocationReference,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordQl248SourceReceiptExceptionReassessment({
  actorUserId,
  ...raw
}) {
  const v = normalizeQl248SourceReceiptExceptionReassessment(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_ql248_source_receipt_exception_reassessments(id,ql248_renewal_id,prior_review_id,source_campground_id,target_campground_id,source_system,repository,review_kind,outcome_kind,denial_receipt_ids,source_audit_reference,owner_authorization_reference,rollback_reference,revocation_reference,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning id,observed_prior_gap_count,observed_current_gap_count,observed_gap_age_days,observed_prior_overdue_days,observed_open_145_exceptions,observed_overdue_145_leaves,phase_b_test_authorized,owner_pilot_authorized,connection_state,gate_state`,
      [
        v.id,
        v.ql248RenewalId,
        v.priorReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.sourceSystem,
        v.repository,
        v.reviewKind,
        v.outcomeKind,
        v.denialReceiptIds,
        v.sourceAuditReference,
        v.ownerAuthorizationReference,
        v.rollbackReference,
        v.revocationReference,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordQl252SourceAuditHoldReview({
  actorUserId,
  ...raw
}) {
  const v = normalizeQl252SourceAuditHoldReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_ql252_proof_denial_hold_reviews(id,ql248_source_review_id,prior_review_id,source_campground_id,target_campground_id,source_system,repository,review_kind,outcome_kind,source_revision_sha,source_ci_run_url,proof_commit_sha,proof_sha256,public_spki_sha256,source_audit_reference,denial_receipt_ids,denial_witness_reference,owner_test_receipt_id,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) returning id,observed_root_gap_count,observed_current_gap_count,observed_gap_age_days,observed_prior_overdue_days,observed_open_146_exceptions,observed_overdue_146_leaves,owner_test_authorized,owner_pilot_authorized,actual_gateway_test,connection_state,gate_state`,
      [
        v.id,
        v.ql248SourceReviewId,
        v.priorReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.sourceSystem,
        v.repository,
        v.reviewKind,
        v.outcomeKind,
        v.sourceRevisionSha,
        v.sourceCiRunUrl,
        v.proofCommitSha,
        v.proofSha256,
        v.publicSpkiSha256,
        v.sourceAuditReference,
        v.denialReceiptIds,
        v.denialWitnessReference,
        v.ownerTestReceiptId,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordQl253ProofCustodyOwnerHoldReview({
  actorUserId,
  ...raw
}) {
  const v = normalizeQl253HoldReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_ql253_proof_custody_owner_hold_reviews(id,ql252_review_id,prior_review_id,source_campground_id,target_campground_id,source_system,repository,review_kind,outcome_kind,source_revision_sha,source_ci_run_url,proof_commit_sha,proof_sha256,public_spki_sha256,proof_http_status,source_audit_reference,custodian_receipt_id,distinct_witness_receipt_id,challenge_sha256,custody_pin_sha256,challenge_issued_at,challenge_expires_at,owner_test_receipt_id,test_tenant_id,test_window_start,test_window_end,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values(${Array.from({ length: 30 }, (_, i) => `$${i + 1}`).join(",")}) returning id,observed_ql252_gap_count,observed_ql252_gap_age_days,observed_prior_overdue_days,signed_proof_independently_trusted,independent_custody_pin_verified,owner_test_authorized,actual_gateway_test,connection_state,gate_state`,
      [
        v.id,
        v.ql252ReviewId,
        v.priorReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.sourceSystem,
        v.repository,
        v.reviewKind,
        v.outcomeKind,
        v.sourceRevisionSha,
        v.sourceCiRunUrl,
        v.proofCommitSha,
        v.proofSha256,
        v.publicSpkiSha256,
        v.proofHttpStatus,
        v.sourceAuditReference,
        v.custodianReceiptId,
        v.distinctWitnessReceiptId,
        v.challengeSha256,
        v.custodyPinSha256,
        v.challengeIssuedAt,
        v.challengeExpiresAt,
        v.ownerTestReceiptId,
        v.testTenantId,
        v.testWindowStart,
        v.testWindowEnd,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordQl254OriginalProofRegistryOwnerHoldReview({
  actorUserId,
  ...raw
}) {
  const v = normalizeQl254HoldReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_ql254_original_proof_registry_owner_hold_reviews(id,ql253_review_id,prior_review_id,source_campground_id,target_campground_id,source_system,repository,review_kind,outcome_kind,main_revision_sha,source_revision_sha,source_ci_run_url,proof_commit_sha,proof_sha256,public_spki_sha256,proof_http_status,source_audit_reference,registry_snapshot_sha256,registry_receipt_id,custodian_receipt_id,witness_receipt_id,registry_pin_sha256,nonce_challenge_sha256,nonce_issued_at,nonce_expires_at,owner_test_receipt_id,test_tenant_id,test_window_start,test_window_end,relay_readiness,next_due_at,evidence_reference,review_note,reviewed_by_user_id) values(${Array.from({ length: 34 }, (_, i) => `$${i + 1}`).join(",")}) returning id,observed_original_denial_gap,observed_custody_evidence_age_days,observed_prior_overdue_days,observed_private_receipt_index_gap,private_pin_registry_independently_verified,owner_test_authorized,relay_running,actual_gateway_test,connection_state,gate_state`,
      [
        v.id,
        v.ql253ReviewId,
        v.priorReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.sourceSystem,
        v.repository,
        v.reviewKind,
        v.outcomeKind,
        v.mainRevisionSha,
        v.sourceRevisionSha,
        v.sourceCiRunUrl,
        v.proofCommitSha,
        v.proofSha256,
        v.publicSpkiSha256,
        v.proofHttpStatus,
        v.sourceAuditReference,
        v.registrySnapshotSha256,
        v.registryReceiptId,
        v.custodianReceiptId,
        v.witnessReceiptId,
        v.registryPinSha256,
        v.nonceChallengeSha256,
        v.nonceIssuedAt,
        v.nonceExpiresAt,
        v.ownerTestReceiptId,
        v.testTenantId,
        v.testWindowStart,
        v.testWindowEnd,
        v.relayReadiness,
        v.nextDueAt,
        v.evidenceReference,
        v.reviewNote,
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
