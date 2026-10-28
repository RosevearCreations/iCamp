import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { getRecurrenceLedger } from "@/lib/permanent-unit-owner-retention/recurrence-postgres.mjs";
import { gatewayHoldReceiptKinds } from "@/lib/permanent-unit-owner-retention/recurrence-core.mjs";
import {
  recordRecurrenceReviewAction,
  recordRecurrenceDecisionAction,
  recordRecurrenceReassessmentAction,
  recordEvidenceGapAction,
  recordExceptionRecurrenceAction,
  recordIndependentClosureAction,
  recordClosureOwnerDecisionAction,
  recordIndependentClosureFollowupAction,
  recordOwnerIndependentHandoffAction,
  recordHandoffIndependentClosureAuditAction,
  recordClosureAuditOwnerSignoffAction,
  recordOwnerSignoffIndependentCloseoutAction,
  recordIndependentCloseoutOwnerOutcomeAction,
  recordOwnerEvidenceIndependentDispositionAction,
  recordIndependentDispositionRecheckAction,
  recordIndependentRecheckOwnerDecisionAction,
  recordIndependentProofContinuityReviewAction,
  recordClosureRecurrenceEventAction,
  recordReopenedExceptionAgingReviewAction,
  recordContinuityResolutionFollowupAction,
  recordVerifiedClosureMonitorAction,
  recordReopeningFollowupOversightAction,
  recordEscalationResolutionRenewalAction,
  recordRenewalFreshnessDecisionAction,
  recordContinuityRecurrenceRecheckAction,
  recordOwnerRecheckRenewalWatchAction,
  recordContinuityEvidenceReconciliationAction,
  recordOwnerProofGatewayReviewAction,
  recordGatewayHoldReceiptReviewAction,
} from "./actions";
const gatewayHoldReceiptOptions: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  independent_gateway_hold_freshness_review: [
    {
      value: "hold_evidence_unverified",
      label: "Read-only HOLD evidence unverified",
    },
    {
      value: "hold_evidence_stale",
      label: "Source proof or independent review overdue",
    },
    {
      value: "hold_evidence_missing",
      label: "Independent original evidence missing",
    },
  ],
  aged_exception_recurrence_watch: [
    {
      value: "no_new_exception_observed",
      label: "No open/overdue exception observed by database",
    },
    {
      value: "exception_recurrence_detected",
      label: "Observed open or overdue recurrence",
    },
    {
      value: "exception_recurrence_escalated",
      label: "Escalate unresolved evidence exception",
    },
  ],
  owner_safe_receipt_verification_queue: [
    { value: "receipt_missing", label: "Not yet received — missing" },
    {
      value: "receipt_not_provisioned",
      label: "Not provisioned — no test/key",
    },
    {
      value: "receipt_reference_unverified",
      label: "Nonsecret receipt reference supplied, not verified",
    },
    {
      value: "receipt_escalated",
      label: "Escalate for independent original proof",
    },
  ],
};
const ownerProofGateOptions: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  independent_owner_proof_renewal: [
    {
      value: "renewal_current",
      label: "New independent same-root proof is current",
    },
    {
      value: "renewal_source_drift",
      label: "Proof source drift or recurrence detected",
    },
    {
      value: "renewal_escalated",
      label: "Independent owner proof needs escalation",
    },
  ],
  aged_exception_disposition: [
    {
      value: "aged_exception_reconciled",
      label: "Independent aged exception reconciled",
    },
    {
      value: "aged_exception_overdue",
      label: "Verified aged exception remains overdue",
    },
    {
      value: "aged_exception_escalated",
      label: "Escalate aging source exception",
    },
  ],
  cross_system_read_only_gate_review: [
    {
      value: "gateway_documented_hold",
      label: "Reference IDs documented; connection remains HOLD",
    },
    {
      value: "gateway_evidence_missing",
      label: "Missing independent gateway/witness receipts; HOLD",
    },
    {
      value: "gateway_review_escalated",
      label: "Escalate read-only gate blockers; HOLD",
    },
  ],
};
const evidenceReconciliationOutcomes: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  independent_continuity_evidence_recurrence_review: [
    {
      value: "recurrence_stable",
      label: "No new recurrence; source remains verified",
    },
    {
      value: "recurrence_drift",
      label: "Evidence drift or recurrence detected",
    },
    {
      value: "recurrence_escalated",
      label: "Escalate independent recurrence review",
    },
  ],
  aging_exception_followup: [
    {
      value: "aging_exception_current",
      label: "Independent aging exception remains current",
    },
    {
      value: "aging_exception_overdue",
      label: "Verified overdue exception remains open",
    },
    { value: "aging_exception_escalated", label: "Escalate overdue follow-up" },
  ],
  owner_audit_proof_reconciliation: [
    {
      value: "owner_proof_reconciled",
      label: "New independent same-root owner proof reconciled",
    },
    {
      value: "owner_proof_gap",
      label: "Owner evidence is incomplete or stale",
    },
    {
      value: "owner_proof_escalated",
      label: "Escalate unresolved owner proof gap",
    },
  ],
};
const ownerRecheckRenewalOptions: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  independent_owner_recheck_recurrence_renewal: [
    {
      value: "renewal_stable",
      label: "Independent recurrence renewal remains stable",
    },
    {
      value: "recurrence_detected",
      label: "Renewal recurrence or source discrepancy detected",
    },
    {
      value: "recurrence_escalated",
      label: "Renewal recurrence needs owner escalation",
    },
  ],
  overdue_exception_disposition: [
    {
      value: "exception_reconciled",
      label: "No unresolved overdue exception; reconciled",
    },
    {
      value: "exception_overdue",
      label: "Source-verified exception is overdue",
    },
    {
      value: "exception_escalated",
      label: "Escalate unresolved overdue exception",
    },
  ],
  continuity_evidence_watch: [
    {
      value: "continuity_evidence_verified",
      label: "Newer independent same-root evidence verified",
    },
    {
      value: "continuity_evidence_stale",
      label: "Evidence is missing or out of date",
    },
    {
      value: "continuity_evidence_escalated",
      label: "Escalate continuity evidence shortfall",
    },
  ],
};
const continuityRecheckOptions: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  independent_continuity_recurrence_watch: [
    {
      value: "continuity_stable",
      label: "Continuity stable: evidence and exceptions current",
    },
    {
      value: "continuity_recurrence_detected",
      label: "New reopening or continuity recurrence detected",
    },
    {
      value: "continuity_escalation_required",
      label: "Independent owner escalation required",
    },
  ],
  renewal_exception_followup_aging: [
    {
      value: "renewal_evidence_current",
      label: "Renewal exception follow-up evidence is current",
    },
    {
      value: "renewal_exception_overdue",
      label: "Renewal exception overdue or evidence missing",
    },
    {
      value: "renewal_exception_escalated",
      label: "Escalate overdue renewal exception",
    },
  ],
  verified_owner_audit_recheck: [
    {
      value: "owner_audit_reverified",
      label: "Reverified using newer independent same-root proof",
    },
    {
      value: "owner_audit_on_hold",
      label: "Maintain owner audit exception for review",
    },
    {
      value: "owner_audit_escalated",
      label: "Escalate owner audit proof failure",
    },
  ],
};
const renewalFreshnessOptions: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  independent_renewal_freshness_comparison: [
    {
      value: "freshness_verified",
      label: "New independent same-root evidence verified",
    },
    { value: "freshness_stale", label: "Evidence is stale or not renewed" },
    {
      value: "freshness_gap_escalated",
      label: "Escalate missing or overdue new proof",
    },
  ],
  reopening_watch_exception_reassessment: [
    {
      value: "watch_no_exception",
      label: "Recheck confirms no new reopening exception",
    },
    {
      value: "watch_reopened_exception",
      label: "Recheck identifies newer reopening or discrepancy",
    },
    {
      value: "watch_escalation_required",
      label: "Independent recheck requires owner escalation",
    },
  ],
  owner_continuity_decision_audit: [
    {
      value: "owner_continuity_confirmed",
      label: "Audit independent exception-free continuity",
    },
    {
      value: "owner_evidence_renewal_due",
      label: "Owner evidence renewal still due",
    },
    {
      value: "owner_continuity_escalated",
      label: "Escalate owner's unresolved continuity exception",
    },
  ],
};
const escalationRenewalOptions: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  independent_resolution_followup: [
    {
      value: "resolution_evidence_current",
      label: "Independent fresh resolution evidence confirmed",
    },
    {
      value: "resolution_evidence_gap",
      label: "Resolution follow-up evidence incomplete",
    },
    {
      value: "resolution_followup_escalated",
      label: "Escalate unresolved resolution follow-up",
    },
  ],
  reopening_recurrence_watch: [
    {
      value: "recurrence_watch_stable",
      label: "Independent new-proof recurrence watch stable",
    },
    {
      value: "reopening_recurrence_detected",
      label: "Later owner reopening or recurrence detected",
    },
    {
      value: "recurrence_escalation_required",
      label: "Recurrence requires owner escalation",
    },
  ],
  owner_evidence_renewal: [
    {
      value: "owner_evidence_renewed",
      label: "Independently verify fresh owner evidence renewal",
    },
    {
      value: "owner_evidence_pending",
      label: "Owner evidence renewal remains pending",
    },
    {
      value: "owner_evidence_escalated",
      label: "Renew owner evidence escalation",
    },
  ],
};
const reopeningOversightOptions: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  independent_reopening_followup: [
    {
      value: "reopening_evidence_current",
      label: "Independent reopening evidence current",
    },
    {
      value: "reopening_evidence_gap",
      label: "Reopening evidence gap requires follow-up",
    },
    {
      value: "reopening_followup_escalated",
      label: "Escalate overdue or incomplete reopening proof",
    },
  ],
  closure_recurrence_decision_replay: [
    {
      value: "replay_continuity_confirmed",
      label: "Source-verified recurrence decision replay",
    },
    {
      value: "replay_source_drift",
      label: "Replay finds new source discrepancy",
    },
    {
      value: "replay_owner_recheck_required",
      label: "Replay requires independent owner recheck",
    },
  ],
  owner_escalation_oversight: [
    {
      value: "owner_escalation_pending",
      label: "Owner escalation evidence pending",
    },
    {
      value: "owner_escalation_renewed",
      label: "Renew overdue owner escalation",
    },
    {
      value: "owner_escalation_resolved",
      label: "Independently verify source-linked escalation resolution",
    },
  ],
};
const verifiedClosureOptions: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  verified_closure_recurrence_monitor: [
    {
      value: "closure_watch_stable",
      label: "Independently confirm a stable closure watch",
    },
    {
      value: "recurrence_evidence_gap",
      label: "Report recurring evidence gap",
    },
    {
      value: "recurrence_watch_escalated",
      label: "Escalate renewed recurrence or overdue finding",
    },
  ],
  independent_evidence_renewal: [
    {
      value: "renewal_evidence_pending",
      label: "Evidence renewal still pending",
    },
    {
      value: "renewal_evidence_rechecked",
      label: "Independently recheck renewed evidence",
    },
    {
      value: "renewal_escalated",
      label: "Escalate overdue or unresolved renewal",
    },
  ],
  overdue_exception_reopening_audit: [
    {
      value: "owner_reopening_required",
      label: "Record that owner reopening is required",
    },
    {
      value: "verified_reopening_linked",
      label: "Verify an actual newer owner reopening event",
    },
  ],
};
const resolutionOptions: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  independent_continuity_recheck: [
    {
      value: "continuity_watch_renewed",
      label: "Renew independent continuity watch",
    },
    {
      value: "recurrence_gap_escalated",
      label: "Escalate recurrence or overdue gap",
    },
    {
      value: "continuity_recheck_confirmed",
      label: "Confirm independent source-linked recheck",
    },
  ],
  overdue_exception_resolution: [
    {
      value: "resolution_evidence_pending",
      label: "Resolution evidence pending",
    },
    {
      value: "overdue_exception_escalated",
      label: "Renew overdue exception escalation",
    },
    {
      value: "resolution_evidence_verified",
      label: "Independently verify resolved evidence",
    },
  ],
  verified_closure_followup: [
    {
      value: "closure_followup_pending",
      label: "Continue closure proof follow-up",
    },
    {
      value: "closure_followup_verified",
      label: "Verify closure follow-up against source evidence",
    },
  ],
};
const previous =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Hold recurrence independent owner decision ledger · iCamp",
  robots: { index: false, follow: false },
};
export default async function RecurrenceDecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    target?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const session = await requireStaff(`${previous}/decisions`),
    params = await searchParams;
  if (!params.source || !params.target) redirect(previous);
  let report;
  try {
    report = await getRecurrenceLedger(
      session.user.id,
      params.source,
      params.target,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /owner|campground|scope|different/i.test(error.message)
    )
      redirect("/auth/not-authorized");
    throw error;
  }
  const pair = (
    <>
      <input type="hidden" name="sourceCampgroundId" value={params.source} />
      <input type="hidden" name="targetCampgroundId" value={params.target} />
    </>
  );
  const resolutionQueue = [
    ...report.reopenedExceptionAgingReviews
      .filter(
        (r) =>
          !report.reopenedExceptionAgingReviews.some(
            (child) => child.prior_review_id === r.id,
          ) &&
          !report.continuityResolutionFollowups.some(
            (f) => f.aging_review_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        agingReviewId: r.id,
        priorFollowupId: "",
        followupKind: "independent_continuity_recheck",
        status: r.aging_status,
      })),
    ...report.continuityResolutionFollowups
      .filter(
        (r) =>
          r.outcome_kind !== "closure_followup_verified" &&
          !report.continuityResolutionFollowups.some(
            (child) => child.prior_followup_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        agingReviewId: r.aging_review_id,
        priorFollowupId: r.id,
        followupKind:
          r.followup_kind === "independent_continuity_recheck"
            ? r.outcome_kind === "continuity_recheck_confirmed"
              ? "overdue_exception_resolution"
              : "independent_continuity_recheck"
            : r.followup_kind === "overdue_exception_resolution"
              ? r.outcome_kind === "resolution_evidence_verified"
                ? "verified_closure_followup"
                : "overdue_exception_resolution"
              : "verified_closure_followup",
        status: r.resolution_status,
      })),
  ];
  const closureMonitorQueue = [
    ...report.continuityResolutionFollowups
      .filter(
        (r) =>
          r.outcome_kind === "closure_followup_verified" &&
          !report.verifiedClosureMonitors.some(
            (m) => m.closure_followup_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        closureFollowupId: r.id,
        priorMonitorId: "",
        monitorKind: "verified_closure_recurrence_monitor",
        status: r.resolution_status,
      })),
    ...report.verifiedClosureMonitors
      .filter(
        (r) =>
          r.outcome_kind !== "verified_reopening_linked" &&
          !report.verifiedClosureMonitors.some(
            (child) => child.prior_monitor_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        closureFollowupId: r.closure_followup_id,
        priorMonitorId: r.id,
        monitorKind:
          r.monitor_kind === "verified_closure_recurrence_monitor"
            ? r.outcome_kind === "closure_watch_stable"
              ? "verified_closure_recurrence_monitor"
              : "independent_evidence_renewal"
            : r.monitor_kind === "independent_evidence_renewal"
              ? r.outcome_kind === "renewal_evidence_rechecked"
                ? "verified_closure_recurrence_monitor"
                : r.outcome_kind === "renewal_escalated"
                  ? "overdue_exception_reopening_audit"
                  : "independent_evidence_renewal"
              : "overdue_exception_reopening_audit",
        status: r.monitoring_status,
      })),
  ];
  const reopeningOversightQueue = [
    ...report.verifiedClosureMonitors
      .filter(
        (m) =>
          m.outcome_kind === "verified_reopening_linked" &&
          !report.reopeningFollowupOversights.some(
            (r) => r.verified_monitor_id === m.id,
          ),
      )
      .map((m) => ({
        id: m.id,
        verifiedMonitorId: m.id,
        priorOversightId: "",
        oversightKind: "independent_reopening_followup",
        status: m.monitoring_status,
      })),
    ...report.reopeningFollowupOversights
      .filter(
        (r) =>
          r.outcome_kind !== "owner_escalation_resolved" &&
          !report.reopeningFollowupOversights.some(
            (child) => child.prior_oversight_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        verifiedMonitorId: r.verified_monitor_id,
        priorOversightId: r.id,
        oversightKind:
          r.oversight_kind === "independent_reopening_followup"
            ? "closure_recurrence_decision_replay"
            : r.oversight_kind === "closure_recurrence_decision_replay"
              ? r.outcome_kind === "replay_continuity_confirmed"
                ? "independent_reopening_followup"
                : "owner_escalation_oversight"
              : "owner_escalation_oversight",
        status: r.oversight_status,
      })),
  ];
  const escalationRenewalQueue = [
    ...report.reopeningFollowupOversights
      .filter(
        (r) =>
          r.outcome_kind === "owner_escalation_resolved" &&
          !report.escalationResolutionRenewals.some(
            (renewal) => renewal.resolved_oversight_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        resolvedOversightId: r.id,
        priorRenewalId: "",
        renewalKind: "independent_resolution_followup",
        status: r.oversight_status,
      })),
    ...report.escalationResolutionRenewals
      .filter(
        (r) =>
          !report.escalationResolutionRenewals.some(
            (child) => child.prior_renewal_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        resolvedOversightId: r.resolved_oversight_id,
        priorRenewalId: r.id,
        renewalKind:
          r.renewal_kind === "independent_resolution_followup"
            ? "reopening_recurrence_watch"
            : r.renewal_kind === "reopening_recurrence_watch"
              ? "owner_evidence_renewal"
              : r.outcome_kind === "owner_evidence_pending"
                ? "owner_evidence_renewal"
                : "independent_resolution_followup",
        status: r.renewal_status,
      })),
  ];
  const renewalFreshnessQueue = [
    ...report.escalationResolutionRenewals
      .filter(
        (r) =>
          r.renewal_kind === "owner_evidence_renewal" &&
          !report.renewalFreshnessDecisions.some(
            (audit) => audit.owner_renewal_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        ownerRenewalId: r.id,
        priorAuditId: "",
        auditKind: "independent_renewal_freshness_comparison",
        status: r.renewal_status,
      })),
    ...report.renewalFreshnessDecisions
      .filter(
        (r) =>
          !report.renewalFreshnessDecisions.some(
            (child) => child.prior_audit_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        ownerRenewalId: r.owner_renewal_id,
        priorAuditId: r.id,
        auditKind:
          r.audit_kind === "independent_renewal_freshness_comparison"
            ? "reopening_watch_exception_reassessment"
            : r.audit_kind === "reopening_watch_exception_reassessment"
              ? "owner_continuity_decision_audit"
              : "independent_renewal_freshness_comparison",
        status: r.audit_status,
      })),
  ];
  const continuityRecheckQueue = [
    ...report.renewalFreshnessDecisions
      .filter(
        (r) =>
          r.audit_kind === "owner_continuity_decision_audit" &&
          !report.continuityRecurrenceRechecks.some(
            (check) => check.owner_continuity_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        ownerContinuityId: r.id,
        priorRecheckId: "",
        recheckKind: "independent_continuity_recurrence_watch",
        status: r.audit_status,
      })),
    ...report.continuityRecurrenceRechecks
      .filter(
        (r) =>
          !report.continuityRecurrenceRechecks.some(
            (child) => child.prior_recheck_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        ownerContinuityId: r.owner_continuity_id,
        priorRecheckId: r.id,
        recheckKind:
          r.recheck_kind === "independent_continuity_recurrence_watch"
            ? "renewal_exception_followup_aging"
            : r.recheck_kind === "renewal_exception_followup_aging"
              ? "verified_owner_audit_recheck"
              : "independent_continuity_recurrence_watch",
        status: r.recheck_status,
      })),
  ];
  const ownerRecheckRenewalQueue = [
    ...report.continuityRecurrenceRechecks
      .filter(
        (r) =>
          r.recheck_kind === "verified_owner_audit_recheck" &&
          !report.ownerRecheckRenewalWatches.some(
            (watch) => watch.owner_recheck_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        ownerRecheckId: r.id,
        priorWatchId: "",
        watchKind: "independent_owner_recheck_recurrence_renewal",
        status: r.recheck_status,
      })),
    ...report.ownerRecheckRenewalWatches
      .filter(
        (r) =>
          !report.ownerRecheckRenewalWatches.some(
            (child) => child.prior_watch_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        ownerRecheckId: r.owner_recheck_id,
        priorWatchId: r.id,
        watchKind:
          r.watch_kind === "independent_owner_recheck_recurrence_renewal"
            ? "overdue_exception_disposition"
            : r.watch_kind === "overdue_exception_disposition"
              ? "continuity_evidence_watch"
              : "independent_owner_recheck_recurrence_renewal",
        status: r.watch_status,
      })),
  ];
  const evidenceReconciliationQueue = [
    ...report.ownerRecheckRenewalWatches
      .filter(
        (r) =>
          r.watch_kind === "continuity_evidence_watch" &&
          !report.continuityEvidenceReconciliations.some(
            (audit) => audit.continuity_watch_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        continuityWatchId: r.id,
        priorReconciliationId: "",
        reviewKind: "independent_continuity_evidence_recurrence_review",
        status: r.watch_status,
      })),
    ...report.continuityEvidenceReconciliations
      .filter(
        (r) =>
          !report.continuityEvidenceReconciliations.some(
            (child) => child.prior_reconciliation_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        continuityWatchId: r.continuity_watch_id,
        priorReconciliationId: r.id,
        reviewKind:
          r.review_kind === "independent_continuity_evidence_recurrence_review"
            ? "aging_exception_followup"
            : r.review_kind === "aging_exception_followup"
              ? "owner_audit_proof_reconciliation"
              : "independent_continuity_evidence_recurrence_review",
        status: r.reconciliation_status,
      })),
  ];
  const ownerProofGatewayQueue = [
    ...report.continuityEvidenceReconciliations
      .filter(
        (r) =>
          r.review_kind === "owner_audit_proof_reconciliation" &&
          !report.ownerProofGatewayReviews.some(
            (review) => review.owner_reconciliation_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        ownerReconciliationId: r.id,
        priorReviewId: "",
        reviewKind: "independent_owner_proof_renewal",
        status: r.reconciliation_status,
      })),
    ...report.ownerProofGatewayReviews
      .filter(
        (r) =>
          !report.ownerProofGatewayReviews.some(
            (child) => child.prior_review_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        ownerReconciliationId: r.owner_reconciliation_id,
        priorReviewId: r.id,
        reviewKind:
          r.review_kind === "independent_owner_proof_renewal"
            ? "aged_exception_disposition"
            : r.review_kind === "aged_exception_disposition"
              ? "cross_system_read_only_gate_review"
              : "independent_owner_proof_renewal",
        status: r.review_status,
      })),
  ];
  const gatewayHoldReceiptQueue = [
    ...report.ownerProofGatewayReviews
      .filter(
        (r) =>
          r.review_kind === "cross_system_read_only_gate_review" &&
          !report.gatewayHoldReceiptReviews.some(
            (q) => q.gateway_review_id === r.id,
          ),
      )
      .map((r) => ({
        id: r.id,
        gatewayReviewId: r.id,
        priorReviewId: "",
        reviewKind: "independent_gateway_hold_freshness_review",
        status: r.review_status,
      })),
    ...report.gatewayHoldReceiptReviews
      .filter(
        (r) =>
          !report.gatewayHoldReceiptReviews.some(
            (child) => child.prior_review_id === r.id,
          ),
      )
      .flatMap((r) =>
        (r.review_kind === "independent_gateway_hold_freshness_review"
          ? ["aged_exception_recurrence_watch"]
          : r.review_kind === "aged_exception_recurrence_watch"
            ? ["owner_safe_receipt_verification_queue"]
            : [
                "owner_safe_receipt_verification_queue",
                "independent_gateway_hold_freshness_review",
              ]
        ).map((reviewKind) => ({
          id: `${r.id}-${reviewKind}`,
          gatewayReviewId: r.gateway_review_id,
          priorReviewId: r.id,
          reviewKind,
          status: r.review_status,
        })),
      ),
  ];
  return (
    <AppShell>
      <main className="page-stack">
        <p>
          <Link
            href={`${previous}?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Back to recurrence oversight
          </Link>
        </p>
        <h1>Hold recurrence owner review &amp; independent follow-up ledger</h1>
        <p>
          Private owner records. Recurrence counts are captured by the database;
          an independent owner then decides the follow-up. Nothing here changes
          source cases, approvals, payments or customer records.
        </p>
        {params.saved && <p role="status">{params.saved}</p>}
        {params.error && <p role="alert">{params.error}</p>}
        {report.limited && (
          <p role="status">
            Display limited to 100 accepted records and 150 review/decision
            events. Full history is preserved.
          </p>
        )}
        <section>
          <h2>Record owner recurrence review</h2>
          <form action={recordRecurrenceReviewAction}>
            {pair}
            <label>
              Original acceptance{" "}
              <select name="acceptanceId" required>
                {report.acceptances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Review rationale{" "}
              <textarea
                name="reviewNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button type="submit" disabled={!report.acceptances.length}>
              Record immutable review
            </button>
          </form>
        </section>
        <section>
          <h2>Independent follow-up decision</h2>
          <form action={recordRecurrenceDecisionAction}>
            {pair}
            <label>
              Owner review{" "}
              <select name="recurrenceReviewId" required>
                {report.reviews.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {r.observed_plan_count} plans,{" "}
                    {r.observed_continued_holds} holds
                  </option>
                ))}
              </select>
            </label>
            <label>
              Decision{" "}
              <select name="decisionKind">
                <option value="continue_monitoring">Continue monitoring</option>
                <option value="request_evidence">Request more evidence</option>
                <option value="manual_escalation">Manual escalation</option>
                <option value="independent_no_action">
                  No further action (if clear)
                </option>
              </select>
            </label>
            <label>
              Next review date (UTC; leave empty for no action){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent rationale{" "}
              <textarea
                name="decisionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button type="submit" disabled={!report.reviews.length}>
              Record independent decision
            </button>
          </form>
        </section>
        <section>
          <h2>Follow-up aging &amp; independent reassessment</h2>
          <p>
            Past-due decisions are marked for review; they do not automatically
            release a hold. A separate owner who neither authored the original
            review nor made its decision must assess the evidence.
          </p>
          <ul>
            {report.decisions.map((d) => (
              <li key={d.id}>
                {d.id} · {d.followup_status} ·{" "}
                {d.next_due_at
                  ? new Date(d.next_due_at).toISOString().slice(0, 10)
                  : "no follow-up due"}
              </li>
            ))}
          </ul>
          <form action={recordRecurrenceReassessmentAction}>
            {pair}
            <label>
              Pending follow-up decision{" "}
              <select name="recurrenceDecisionId" required>
                {report.decisions
                  .filter(
                    (d) =>
                      !d.reassessment_id &&
                      d.decision_kind !== "independent_no_action",
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.followup_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Independent finding{" "}
              <select name="assessmentKind" required>
                <option value="continue_hold">Continue hold</option>
                <option value="request_new_evidence">
                  Request new evidence
                </option>
                <option value="manual_escalation">Escalate manually</option>
                <option value="confirm_resolution">
                  Confirm resolution (only if clear)
                </option>
              </select>
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent rationale{" "}
              <textarea
                name="assessmentNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.decisions.some(
                  (d) =>
                    !d.reassessment_id &&
                    d.decision_kind !== "independent_no_action",
                )
              }
            >
              Record immutable reassessment
            </button>
          </form>
          <h3>Reassessment history</h3>
          <ul>
            {report.reassessments.map((r) => (
              <li key={r.id}>
                {r.assessment_kind} · {r.recurrence_decision_id} —{" "}
                {r.assessment_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Evidence gap aging &amp; owner action reconciliation</h2>
          <p>
            Track outstanding independent reassessment evidence, including 30+
            day gaps and overdue owner follow-up dates. This private ledger
            records owner actions only; reconciliation never automatically lifts
            a hold or overrides an independent decision.
          </p>
          {report.reassessments.length === 0 && (
            <p>No independent reassessments to reconcile.</p>
          )}
          <ul>
            {report.reassessments.map((r) => (
              <li key={r.id}>
                {r.id} · {r.gap_status} · assessed{" "}
                {new Date(r.assessed_at).toISOString().slice(0, 10)}
              </li>
            ))}
          </ul>
          <form action={recordEvidenceGapAction}>
            {pair}
            <label>
              Open independent reassessment{" "}
              <select name="reassessmentId" required>
                {report.reassessments
                  .filter(
                    (r) =>
                      r.assessment_kind !== "confirm_resolution" &&
                      r.gap_status !== "owner_reconciled",
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.gap_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner action{" "}
              <select name="actionKind" required>
                <option value="evidence_requested">Request evidence</option>
                <option value="evidence_submitted">
                  Evidence submitted for review
                </option>
                <option value="manual_escalation">Manual escalation</option>
                <option value="owner_reconciled">
                  Owner reconciliation after evidence submitted
                </option>
              </select>
            </label>
            <label>
              Next due (UTC; required for requests and escalations only){" "}
              <input name="nextDueAt" type="date" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Action rationale{" "}
              <textarea
                name="actionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.reassessments.some(
                  (r) =>
                    r.assessment_kind !== "confirm_resolution" &&
                    r.gap_status !== "owner_reconciled",
                )
              }
            >
              Record immutable owner action
            </button>
          </form>
          <h3>Owner action history</h3>
          {report.limited && (
            <p role="status">
              Recent owner actions are limited to 300 records on this screen.
              Audit history remains in the database.
            </p>
          )}
          <ul>
            {report.ownerActions.map((a) => (
              <li key={a.id}>
                {a.action_kind} · {a.reassessment_id} — {a.action_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Reconciliation exception recurrence &amp; independent closure
            recheck
          </h2>
          <p>
            Owner reviews freeze current pair-wide open, overdue, and recurring
            gaps. A different authorized owner independently rechecks closure.
            This is audit closure only: no automatic release of holds,
            transfers, finance actions, or customer notifications.
          </p>
          <form action={recordExceptionRecurrenceAction}>
            {pair}
            <label>
              Previously reconciled owner action{" "}
              <select name="ownerActionId" required>
                {report.ownerActions
                  .filter(
                    (a) =>
                      a.action_kind === "owner_reconciled" &&
                      !report.exceptionReviews.some(
                        (r) => r.owner_action_id === a.id,
                      ),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Owner recurrence rationale{" "}
              <textarea
                name="reviewNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.ownerActions.some(
                  (a) =>
                    a.action_kind === "owner_reconciled" &&
                    !report.exceptionReviews.some(
                      (r) => r.owner_action_id === a.id,
                    ),
                )
              }
            >
              Record exception recurrence review
            </button>
          </form>
          <h3>Frozen exception recurrence reviews</h3>
          <ul>
            {report.exceptionReviews.map((r) => (
              <li key={r.id}>
                {r.id} · {r.observed_open_gaps} open gaps ·{" "}
                {r.observed_overdue_gaps} overdue ·{" "}
                {r.observed_recurrence_count} previous reconciliations —{" "}
                {r.review_note}
              </li>
            ))}
          </ul>
          <form action={recordIndependentClosureAction}>
            {pair}
            <label>
              Exception recurrence review{" "}
              <select name="exceptionReviewId" required>
                {report.exceptionReviews
                  .filter(
                    (r) =>
                      !report.closureRechecks.some(
                        (c) => c.exception_review_id === r.id,
                      ),
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.observed_open_gaps} open gaps
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Independent closure recheck{" "}
              <select name="recheckKind" required>
                <option value="continue_exception">Continue exception</option>
                <option value="request_new_evidence">
                  Request new evidence
                </option>
                <option value="manual_escalation">Manual escalation</option>
                <option value="independent_audit_closed">
                  Close audit (only if all clear)
                </option>
              </select>
            </label>
            <label>
              Independent evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent rationale{" "}
              <textarea
                name="recheckNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.exceptionReviews.some(
                  (r) =>
                    !report.closureRechecks.some(
                      (c) => c.exception_review_id === r.id,
                    ),
                )
              }
            >
              Record immutable closure recheck
            </button>
          </form>
          <h3>Independent closure recheck history</h3>
          <ul>
            {report.closureRechecks.map((c) => (
              <li key={c.id}>
                {c.recheck_kind} · {c.exception_review_id} — {c.recheck_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Independent closure follow-up &amp; owner decision aging</h2>
          <p>
            Outstanding independent rechecks are flagged after 30 days without
            an owner decision. Pending owner follow-up dates show overdue and
            30+ day overdue status. These indicators do not change any
            operational hold.
          </p>
          <ul>
            {report.closureRechecks.map((c) => (
              <li key={c.id}>
                {c.id} · {c.owner_decision_status} · independent decision{" "}
                {c.recheck_kind}
              </li>
            ))}
          </ul>
          <form action={recordClosureOwnerDecisionAction}>
            {pair}
            <label>
              Independent closure recheck{" "}
              <select name="closureRecheckId" required>
                {report.closureRechecks
                  .filter(
                    (c) =>
                      !report.closureOwnerDecisions.some(
                        (d) => d.closure_recheck_id === c.id,
                      ),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.owner_decision_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner follow-up decision{" "}
              <select name="decisionKind" required>
                <option value="keep_exception_open">Keep exception open</option>
                <option value="request_evidence">
                  Request additional evidence
                </option>
                <option value="manual_escalation">Escalate manually</option>
                <option value="acknowledge_audit_closure">
                  Acknowledge independently closed audit
                </option>
              </select>
            </label>
            <p>
              For open exceptions, select a future UTC follow-up date within 90
              days. Audit-closure acknowledgments must leave the date blank. The
              database enforces agreement with the independent recheck.
            </p>
            <label>
              Follow-up due date (UTC) <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Owner decision rationale{" "}
              <textarea
                name="decisionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.closureRechecks.some(
                  (c) =>
                    !report.closureOwnerDecisions.some(
                      (d) => d.closure_recheck_id === c.id,
                    ),
                )
              }
            >
              Record immutable owner decision
            </button>
          </form>
          <h3>Owner decision history</h3>
          <ul>
            {report.closureOwnerDecisions.map((d) => (
              <li key={d.id}>
                {d.decision_kind} · {d.closure_recheck_id} — {d.decision_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Owner closure recurrence, overdue escalation &amp; independent
            follow-up
          </h2>
          <p>
            Pair-wide recurrence, unresolved overdue owner follow-ups, and
            earlier manual escalations are frozen when an independent owner
            reviews a decision. Owner deadlines overdue by 30+ days require
            manual escalation. This is an audit-only record: no live hold,
            transfer, payment, or campground status changes.
          </p>
          <ul>
            {report.closureOwnerDecisions.map((d) => (
              <li key={d.id}>
                {d.id} · {d.independent_followup_status} · {d.decision_kind}
                {d.next_due_at
                  ? ` · owner due ${new Date(d.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · no open owner deadline"}
              </li>
            ))}
          </ul>
          <form action={recordIndependentClosureFollowupAction}>
            {pair}
            <label>
              Owner closure decision{" "}
              <select name="ownerDecisionId" required>
                {report.closureOwnerDecisions
                  .filter(
                    (d) =>
                      !report.closureFollowupReviews.some(
                        (r) => r.owner_decision_id === d.id,
                      ),
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.independent_followup_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Independent finding{" "}
              <select name="reviewKind" required>
                <option value="continue_exception">
                  Continue exception (not overdue)
                </option>
                <option value="request_new_evidence">
                  Request new evidence
                </option>
                <option value="manual_escalation">Manual escalation</option>
                <option value="confirm_audit_acknowledged">
                  Confirm independently acknowledged audit (only if clear)
                </option>
              </select>
            </label>
            <p>
              Open reviews need a future UTC follow-up within 90 days. Audit
              confirmation must leave the date empty and requires no captured
              overdue or recurring exceptions. The database checks the review
              against the actual owner decision and independent rechecker.
            </p>
            <label>
              Independent follow-up due (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent review rationale{" "}
              <textarea
                name="reviewNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.closureOwnerDecisions.some(
                  (d) =>
                    !report.closureFollowupReviews.some(
                      (r) => r.owner_decision_id === d.id,
                    ),
                )
              }
            >
              Record immutable independent review
            </button>
          </form>
          <h3>Independent review evidence snapshots</h3>
          <ul>
            {report.closureFollowupReviews.map((r) => (
              <li key={r.id}>
                {r.review_kind} · {r.owner_decision_id} ·{" "}
                {r.observed_recurring_decisions} recurrent ·{" "}
                {r.observed_overdue_decisions} overdue ·{" "}
                {r.observed_escalation_decisions} prior manual escalations ·{" "}
                {r.observed_owner_days_overdue} owner days overdue —{" "}
                {r.review_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Independent outcome aging, owner evidence decisions &amp; escalation
            handoffs
          </h2>
          <p>
            Independent findings awaiting an owner response are tracked by UTC
            due date, including 30+ day overdue handoffs. A different authorized
            owner records the evidence decision or accepts the manual
            escalation. Long-overdue outcomes require an escalation handoff;
            neither an audit acknowledgment nor evidence reconciliation changes
            operational holds.
          </p>
          <ul>
            {report.closureFollowupReviews.map((r) => (
              <li key={r.id}>
                {r.id} · {r.owner_reconciliation_status} · {r.review_kind}
                {r.next_due_at
                  ? ` · independent due ${new Date(r.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · no open independent deadline"}
              </li>
            ))}
          </ul>
          <form action={recordOwnerIndependentHandoffAction}>
            {pair}
            <label>
              Independent follow-up outcome{" "}
              <select name="independentReviewId" required>
                {report.closureFollowupReviews
                  .filter(
                    (r) =>
                      !report.closureHandoffDecisions.some(
                        (d) => d.independent_review_id === r.id,
                      ),
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.owner_reconciliation_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner handoff or evidence outcome{" "}
              <select name="actionKind" required>
                <option value="escalation_handoff_accepted">
                  Accept manual escalation handoff
                </option>
                <option value="evidence_requested">Request evidence</option>
                <option value="evidence_reconciled">
                  Reconcile evidence received (if independently requested)
                </option>
                <option value="monitoring_continues">
                  Continue monitoring (if not overdue)
                </option>
                <option value="audit_confirmation_acknowledged">
                  Acknowledge independently confirmed audit
                </option>
              </select>
            </label>
            <p>
              Open actions need a future UTC due date within 90 days. Leave the
              date empty for reconciled evidence or an acknowledged audit. The
              database enforces compatibility with the independent finding,
              including mandatory escalation of outcomes overdue by 30+ days.
            </p>
            <label>
              Owner handoff due date (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Owner evidence decision rationale{" "}
              <textarea
                name="actionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.closureFollowupReviews.some(
                  (r) =>
                    !report.closureHandoffDecisions.some(
                      (d) => d.independent_review_id === r.id,
                    ),
                )
              }
            >
              Record immutable owner evidence decision
            </button>
          </form>
          <h3>Owner reconciliation &amp; escalation handoff evidence</h3>
          <ul>
            {report.closureHandoffDecisions.map((d) => (
              <li key={d.id}>
                {d.action_kind} · {d.independent_review_id} ·{" "}
                {d.observed_review_days_overdue} days overdue ·{" "}
                {d.observed_peer_overdue_reviews} other overdue ·{" "}
                {d.observed_prior_escalation_handoffs} prior escalations —{" "}
                {d.action_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Owner handoff outcome aging, evidence reassessment &amp; independent
            escalation closure
          </h2>
          <p>
            Owner handoff decisions are monitored for overdue independent
            audits. A separate authorized auditor records an evidence
            reassessment, continued exception, manual escalation, or independent
            audit closure. Closure is strictly audit-ledger only; operational
            holds, cases, payments and customer communications remain unchanged.
          </p>
          <ul>
            {report.closureHandoffDecisions.map((d) => (
              <li key={d.id}>
                {d.id} · {d.independent_audit_status} · {d.action_kind}
                {d.next_due_at
                  ? ` · owner due ${new Date(d.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · no pending owner deadline"}
              </li>
            ))}
          </ul>
          <form action={recordHandoffIndependentClosureAuditAction}>
            {pair}
            <label>
              Owner handoff evidence decision{" "}
              <select name="handoffDecisionId" required>
                {report.closureHandoffDecisions
                  .filter(
                    (d) =>
                      !report.handoffIndependentAudits.some(
                        (a) => a.handoff_decision_id === d.id,
                      ),
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.independent_audit_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Independent audit finding{" "}
              <select name="auditKind" required>
                <option value="continue_exception">
                  Continue exception (if timely)
                </option>
                <option value="request_evidence_reassessment">
                  Request evidence reassessment
                </option>
                <option value="manual_escalation">Escalate manually</option>
                <option value="independent_audit_closed">
                  Close independent audit (only with sufficient evidence)
                </option>
              </select>
            </label>
            <p>
              Open findings require a future UTC date within 90 days. Leave the
              date blank for independent audit closure. Closure requires a valid
              evidence or escalation outcome and no outstanding peer-wide
              exception handoffs; 30+ day overdue open reviews must escalate
              manually. Database safeguards validate these rules.
            </p>
            <label>
              Next independent review due (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent evidence finding{" "}
              <textarea
                name="auditNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.closureHandoffDecisions.some(
                  (d) =>
                    !report.handoffIndependentAudits.some(
                      (a) => a.handoff_decision_id === d.id,
                    ),
                )
              }
            >
              Record immutable independent closure audit
            </button>
          </form>
          <h3>Independent closure audit evidence snapshots</h3>
          <ul>
            {report.handoffIndependentAudits.map((a) => (
              <li key={a.id}>
                {a.audit_kind} · {a.handoff_decision_id} ·{" "}
                {a.observed_handoff_days_overdue} days overdue ·{" "}
                {a.observed_other_open_handoffs} other open ·{" "}
                {a.observed_other_overdue_handoffs} other overdue ·{" "}
                {a.observed_other_escalation_handoffs} other escalations —{" "}
                {a.audit_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Independent audit reassessment aging, owner exception sign-off &amp;
            escalation recurrence
          </h2>
          <p>
            An authorized owner other than the independent auditor, handoff
            actor and earlier reviewer acknowledges a closed audit or signs off
            on an open exception with a scheduled reassessment. An overdue 30+
            day reassessment or recurring escalations require explicit
            escalation acceptance. Database snapshots preserve the peer-wide
            evidence context without closing operational cases or holds.
          </p>
          <ul>
            {report.handoffIndependentAudits.map((a) => (
              <li key={a.id}>
                {a.id} · {a.owner_signoff_status} · {a.audit_kind}
                {a.next_due_at
                  ? ` · reassess by ${new Date(a.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · independent closure, owner acknowledgment pending"}
              </li>
            ))}
          </ul>
          <form action={recordClosureAuditOwnerSignoffAction}>
            {pair}
            <label>
              Independent closure audit{" "}
              <select name="independentAuditId" required>
                {report.handoffIndependentAudits
                  .filter(
                    (a) =>
                      !report.closureAuditOwnerSignoffs.some(
                        (s) => s.independent_audit_id === a.id,
                      ),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} · {a.owner_signoff_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner sign-off decision{" "}
              <select name="signoffKind" required>
                <option value="owner_exception_signed_off">
                  Sign off on a timely, continued exception (still open)
                </option>
                <option value="request_evidence_refresh">
                  Request refreshed independent evidence
                </option>
                <option value="accept_manual_escalation">
                  Accept escalation and schedule a follow-up
                </option>
                <option value="acknowledge_independent_closure">
                  Acknowledge independent audit closure (only if clear)
                </option>
              </select>
            </label>
            <p>
              Open findings need a future UTC owner reassessment date within 90
              days. Leave it blank only for closed-audit acknowledgment. The
              database checks independent signers, overdue findings and
              recurring escalations before accepting a sign-off.
            </p>
            <label>
              Owner reassessment due (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Owner exception sign-off rationale{" "}
              <textarea
                name="signoffNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.handoffIndependentAudits.some(
                  (a) =>
                    !report.closureAuditOwnerSignoffs.some(
                      (s) => s.independent_audit_id === a.id,
                    ),
                )
              }
            >
              Record immutable owner sign-off
            </button>
          </form>
          <h3>Owner exception sign-offs and escalation recurrence snapshots</h3>
          <ul>
            {report.closureAuditOwnerSignoffs.map((s) => (
              <li key={s.id}>
                {s.signoff_kind} · {s.independent_audit_id} ·{" "}
                {s.observed_reassessment_days_overdue} reassessment days overdue
                · {s.observed_peer_open_audits} peer audits open ·{" "}
                {s.observed_peer_overdue_audits} peer audits overdue ·{" "}
                {s.observed_prior_manual_escalations} prior escalations —{" "}
                {s.signoff_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Owner sign-off follow-up aging, escalation evidence refresh &amp;
            independent exception closeout
          </h2>
          <p>
            An independent finance owner reviews signed-off exceptions and
            escalation evidence, separate from the owner signer and previous
            independent auditor. Open findings receive a fresh UTC follow-up; an
            owner sign-off overdue 30+ days requires manual escalation.
            Independent closeout is possible only after an acknowledged,
            independently closed audit and a clear peer-wide exception record.
            This records audit evidence only and never releases a live hold.
          </p>
          <ul>
            {report.closureAuditOwnerSignoffs.map((s) => (
              <li key={s.id}>
                {s.id} · {s.independent_closeout_status} · {s.signoff_kind}
                {s.next_due_at
                  ? ` · owner follow-up ${new Date(s.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · no open owner deadline"}
              </li>
            ))}
          </ul>
          <form action={recordOwnerSignoffIndependentCloseoutAction}>
            {pair}
            <label>
              Owner exception sign-off{" "}
              <select name="ownerSignoffId" required>
                {report.closureAuditOwnerSignoffs
                  .filter(
                    (s) =>
                      !report.signoffIndependentCloseoutReviews.some(
                        (r) => r.owner_signoff_id === s.id,
                      ),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} · {s.independent_closeout_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Independent finding{" "}
              <select name="reviewKind" required>
                <option value="continue_exception">
                  Continue signed-off exception (if timely)
                </option>
                <option value="request_escalation_evidence_refresh">
                  Request refreshed escalation evidence
                </option>
                <option value="manual_escalation">
                  Escalate independently with new evidence
                </option>
                <option value="independent_exception_closed">
                  Confirm independent exception closeout (only if clear)
                </option>
              </select>
            </label>
            <p>
              Schedule an independent follow-up within 90 days for any open
              finding. Leave the date blank only for an eligible independent
              closeout. The database records overdue days, peer exceptions,
              escalation acceptances and recent evidence-refresh requests.
            </p>
            <label>
              Independent follow-up due (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Reassessed evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent exception review rationale{" "}
              <textarea
                name="reviewNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.closureAuditOwnerSignoffs.some(
                  (s) =>
                    !report.signoffIndependentCloseoutReviews.some(
                      (r) => r.owner_signoff_id === s.id,
                    ),
                )
              }
            >
              Record immutable independent exception review
            </button>
          </form>
          <h3>Independent closeout and escalation evidence snapshots</h3>
          <ul>
            {report.signoffIndependentCloseoutReviews.map((r) => (
              <li key={r.id}>
                {r.review_kind} · {r.owner_signoff_id} ·{" "}
                {r.observed_signoff_days_overdue} owner days overdue ·{" "}
                {r.observed_peer_open_signoffs} peer exceptions open ·{" "}
                {r.observed_peer_overdue_signoffs} peer follow-ups overdue ·{" "}
                {r.observed_prior_escalation_acceptances} prior accepted
                escalations · {r.observed_prior_evidence_refreshes} recent
                evidence refreshes — {r.review_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Independent closeout follow-up aging, renewed escalation exceptions
            &amp; owner evidence outcomes
          </h2>
          <p>
            The owner evidence audit tracks independent closeout deadlines,
            fresh evidence submissions and explicit renewal of escalated
            exceptions. A different authorized finance owner responds to the
            independent reviewer. Long-overdue or recurring escalations must be
            renewed, not silently continued. A previously closed audit may only
            be acknowledged when peer exceptions are clear; no operational hold
            or payment is affected.
          </p>
          <ul>
            {report.signoffIndependentCloseoutReviews.map((r) => (
              <li key={r.id}>
                {r.id} · {r.owner_outcome_status} · {r.review_kind}
                {r.next_due_at
                  ? ` · independent due ${new Date(r.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · independent closeout, owner acknowledgment pending"}
              </li>
            ))}
          </ul>
          <form action={recordIndependentCloseoutOwnerOutcomeAction}>
            {pair}
            <label>
              Independent closeout review{" "}
              <select name="closeoutReviewId" required>
                {report.signoffIndependentCloseoutReviews
                  .filter(
                    (r) =>
                      !report.independentCloseoutOwnerOutcomes.some(
                        (o) => o.closeout_review_id === r.id,
                      ),
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.owner_outcome_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner evidence outcome{" "}
              <select name="outcomeKind" required>
                <option value="continue_owner_followup">
                  Continue a timely independent exception follow-up
                </option>
                <option value="submit_refreshed_evidence">
                  Submit refreshed evidence for independent review
                </option>
                <option value="renew_escalation_exception">
                  Renew the escalated exception and follow-up
                </option>
                <option value="acknowledge_independent_closeout">
                  Acknowledge verified independent closeout (only if clear)
                </option>
              </select>
            </label>
            <p>
              Open evidence outcomes require a future UTC follow-up within 90
              days. Leave it blank only for an already independently closed
              exception. The database snapshots overdue days, open and overdue
              peer reviews, recent escalations and repeated renewals.
            </p>
            <label>
              Owner evidence follow-up due (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Refreshed evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Owner evidence outcome rationale{" "}
              <textarea
                name="outcomeNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.signoffIndependentCloseoutReviews.some(
                  (r) =>
                    !report.independentCloseoutOwnerOutcomes.some(
                      (o) => o.closeout_review_id === r.id,
                    ),
                )
              }
            >
              Record immutable owner evidence outcome
            </button>
          </form>
          <h3>Renewed escalation and owner evidence audit snapshots</h3>
          <ul>
            {report.independentCloseoutOwnerOutcomes.map((o) => (
              <li key={o.id}>
                {o.outcome_kind} · {o.closeout_review_id} ·{" "}
                {o.observed_review_days_overdue} days overdue ·{" "}
                {o.observed_peer_open_reviews} peer reviews open ·{" "}
                {o.observed_peer_overdue_reviews} peer reviews overdue ·{" "}
                {o.observed_prior_independent_escalations} earlier independent
                escalations · {o.observed_prior_exception_renewals} exception
                renewals — {o.outcome_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Owner evidence renewal follow-up aging, independent escalation
            disposition &amp; audit closure continuity
          </h2>
          <p>
            An authorized reviewer other than the owner who recorded the
            evidence outcome independently chooses the next evidence renewal
            step. Renewed exceptions, repeated escalations and long-overdue
            follow-ups cannot become passive monitoring. Closure continuity
            requires a prior verified closeout plus no outstanding peer evidence
            or recent escalations. All dispositions are immutable audit records;
            none release operational holds or payments.
          </p>
          <h3>Pending and overdue owner evidence renewals</h3>
          <ul>
            {report.independentCloseoutOwnerOutcomes.map((o) => (
              <li key={o.id}>
                {o.id} · {o.independent_disposition_status} · {o.outcome_kind}
                {o.next_due_at
                  ? ` · owner renewal due ${new Date(o.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · closure acknowledgment awaiting independent continuity review"}
              </li>
            ))}
          </ul>
          <form action={recordOwnerEvidenceIndependentDispositionAction}>
            {pair}
            <label>
              Owner evidence outcome for independent review{" "}
              <select name="ownerOutcomeId" required>
                {report.independentCloseoutOwnerOutcomes
                  .filter(
                    (o) =>
                      !report.ownerEvidenceIndependentDispositions.some(
                        (d) => d.owner_outcome_id === o.id,
                      ),
                  )
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id} · {o.independent_disposition_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Independent evidence disposition{" "}
              <select name="dispositionKind" required>
                <option value="continue_independent_monitoring">
                  Continue timely independent evidence monitoring
                </option>
                <option value="request_owner_evidence_renewal">
                  Request a new owner evidence renewal
                </option>
                <option value="escalate_renewal_exception">
                  Explicitly escalate an overdue or recurring exception
                </option>
                <option value="verify_closure_continuity">
                  Verify independently closed audit continuity (only if clear)
                </option>
              </select>
            </label>
            <p>
              Open dispositions need a future UTC due date within 90 days; leave
              the date blank only when verifying an existing owner
              acknowledgment of independently closed evidence. The database
              snapshots overdue days, unresolved peer outcomes and the last 90
              days of exception renewals and independent escalations.
            </p>
            <label>
              Independent evidence renewal due (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Independent evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent reviewer disposition rationale{" "}
              <textarea
                name="dispositionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.independentCloseoutOwnerOutcomes.some(
                  (o) =>
                    !report.ownerEvidenceIndependentDispositions.some(
                      (d) => d.owner_outcome_id === o.id,
                    ),
                )
              }
            >
              Record immutable independent disposition
            </button>
          </form>
          <h3>Independent renewal and audit-continuity evidence snapshots</h3>
          <ul>
            {report.ownerEvidenceIndependentDispositions.map((d) => (
              <li key={d.id}>
                {d.disposition_kind} · {d.owner_outcome_id} ·{" "}
                {d.observed_owner_days_overdue} owner days overdue ·{" "}
                {d.observed_peer_pending_outcomes} pending peer outcomes ·{" "}
                {d.observed_peer_overdue_outcomes} overdue peer outcomes ·{" "}
                {d.observed_recent_owner_renewals} recent owner renewals ·{" "}
                {d.observed_recent_independent_escalations} recent independent
                escalations — {d.disposition_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Independent escalation follow-up aging, owner evidence replay &amp;
            closure continuity recheck
          </h2>
          <p>
            Recheck an existing independent evidence disposition against its
            original owner outcome or a newer owner evidence refresh. The
            database verifies the complete campground-pair evidence chain and
            records whether the replay is newer. The rechecker must differ from
            the prior independent reviewer and both evidence owners. Escalated,
            recurring or 30-day-overdue cases must remain explicitly escalated.
            Closure continuity can only be reconfirmed without open peer
            dispositions or recent renewals.
          </p>
          <h3>Independent disposition follow-up queue</h3>
          <ul>
            {report.ownerEvidenceIndependentDispositions.map((d) => (
              <li key={d.id}>
                {d.id} · {d.independent_recheck_status} · {d.disposition_kind}
                {d.next_due_at
                  ? ` · recheck due ${new Date(d.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · closure continuity reconfirmation pending"}
              </li>
            ))}
          </ul>
          <form action={recordIndependentDispositionRecheckAction}>
            {pair}
            <label>
              Independent disposition to recheck{" "}
              <select name="independentDispositionId" required defaultValue="">
                <option value="" disabled>
                  Choose an unreviewed independent disposition
                </option>
                {report.ownerEvidenceIndependentDispositions
                  .filter(
                    (d) =>
                      !report.independentDispositionRechecks.some(
                        (r) => r.independent_disposition_id === d.id,
                      ),
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · source owner {d.owner_outcome_id} ·{" "}
                      {d.independent_recheck_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Source-linked owner evidence to replay{" "}
              <select name="replayOwnerOutcomeId" required defaultValue="">
                <option value="" disabled>
                  Choose the source owner outcome or a newer owner refresh
                </option>
                {report.independentCloseoutOwnerOutcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.outcome_kind} ·{" "}
                    {new Date(o.recorded_at).toISOString().slice(0, 10)} UTC
                  </option>
                ))}
              </select>
            </label>
            <p>
              Replaying a different outcome requires evidence recorded later
              than the original, marked as refreshed evidence or escalation
              renewal. Choosing the original replays the existing receipt.
              Closure continuity must use the original acknowledged outcome.
            </p>
            <label>
              Independent recheck outcome{" "}
              <select name="recheckKind" required>
                <option value="continue_followup_watch">
                  Recheck timely evidence monitoring
                </option>
                <option value="request_owner_renewal_replay">
                  Request another owner renewal evidence replay
                </option>
                <option value="renew_escalation_recheck">
                  Renew independent escalation and follow-up
                </option>
                <option value="confirm_closure_continuity_recheck">
                  Reconfirm independently verified closure (only if clear)
                </option>
              </select>
            </label>
            <p>
              Open rechecks need a future UTC follow-up within 90 days. Only a
              closed audit reconfirmation has no due date. Rechecks never
              authorize live hold releases, transfers or payments.
            </p>
            <label>
              Next independent recheck due (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence replay receipt or reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent recheck rationale{" "}
              <textarea
                name="recheckNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.ownerEvidenceIndependentDispositions.some(
                  (d) =>
                    !report.independentDispositionRechecks.some(
                      (r) => r.independent_disposition_id === d.id,
                    ),
                )
              }
            >
              Record immutable independent recheck
            </button>
          </form>
          <h3>Replay, independent escalation and continuity audit snapshots</h3>
          <ul>
            {report.independentDispositionRechecks.map((r) => (
              <li key={r.id}>
                {r.recheck_kind} · disposition {r.independent_disposition_id} ·
                owner evidence {r.replay_owner_outcome_id} · replay{" "}
                {r.observed_replay_is_newer ? "newer" : "original"} ·{" "}
                {r.observed_disposition_days_overdue} days overdue ·{" "}
                {r.observed_peer_pending_dispositions} pending peer dispositions
                · {r.observed_peer_overdue_dispositions} overdue peer
                dispositions · {r.observed_recent_escalation_rechecks} recent
                escalation rechecks · {r.observed_recent_owner_renewals} recent
                owner renewals — {r.recheck_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Owner replay evidence-gap aging, independent recheck exception
            decisions &amp; closure proof continuity
          </h2>
          <p>
            Review open or overdue source-linked evidence rechecks. A finance
            owner other than the independent rechecker can submit gap evidence,
            renew an escalation or acknowledge verified closure proof. The
            database calculates overdue and peer-exception counts and verifies
            the original owner acknowledgment, independent closeout, independent
            disposition and replay recheck before accepting closure. These audit
            decisions do not release holds, transfer assets or move money.
          </p>
          <h3>Owner replay-gap follow-up queue</h3>
          <ul>
            {report.independentDispositionRechecks.map((r) => (
              <li key={r.id}>
                {r.id} · {r.owner_gap_status} · {r.recheck_kind} · replay{" "}
                {r.observed_replay_is_newer
                  ? "newer evidence"
                  : "original evidence"}
                {r.next_due_at
                  ? ` · owner due ${new Date(r.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · closure proof owner acknowledgment pending"}
              </li>
            ))}
          </ul>
          <form action={recordIndependentRecheckOwnerDecisionAction}>
            {pair}
            <label>
              Independently rechecked evidence for owner disposition{" "}
              <select name="independentRecheckId" required defaultValue="">
                <option value="" disabled>
                  Choose an independent recheck awaiting owner action
                </option>
                {report.independentDispositionRechecks
                  .filter(
                    (r) =>
                      !report.independentRecheckOwnerDecisions.some(
                        (d) => d.independent_recheck_id === r.id,
                      ),
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.owner_gap_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner replay-gap exception decision{" "}
              <select name="decisionKind" required>
                <option value="continue_replay_followup">
                  Continue timely unchanged replay follow-up
                </option>
                <option value="submit_replay_gap_evidence">
                  Submit evidence for the replay gap
                </option>
                <option value="renew_escalation_exception">
                  Renew independent recheck escalation exception
                </option>
                <option value="acknowledge_closure_proof">
                  Acknowledge independently verified closure proof (only if
                  clear)
                </option>
              </select>
            </label>
            <p>
              Open replay-gap decisions require a future UTC follow-up within 90
              days. Leave the date empty only for verified closure proof.
              Recurrent, escalated and 30-day-overdue gaps require explicit
              escalation renewal. Only the database decides if closure proof is
              complete and free of unresolved peer exceptions.
            </p>
            <label>
              Next owner replay-gap follow-up due (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Replay evidence gap or closure proof reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Owner exception decision rationale{" "}
              <textarea
                name="decisionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.independentDispositionRechecks.some(
                  (r) =>
                    !report.independentRecheckOwnerDecisions.some(
                      (d) => d.independent_recheck_id === r.id,
                    ),
                )
              }
            >
              Record immutable replay-gap owner decision
            </button>
          </form>
          <h3>Replay gap, escalation and closure proof snapshots</h3>
          <ul>
            {report.independentRecheckOwnerDecisions.map((d) => (
              <li key={d.id}>
                {d.decision_kind} · independent recheck{" "}
                {d.independent_recheck_id}· replay{" "}
                {d.observed_replay_is_newer ? "newer" : "original"} · closure
                proof{" "}
                {d.observed_closure_proof_chain_complete
                  ? "complete"
                  : "not independently established"}{" "}
                · {d.observed_recheck_days_overdue} days overdue ·{" "}
                {d.observed_peer_open_rechecks} peer rechecks open ·{" "}
                {d.observed_peer_overdue_rechecks} peer rechecks overdue ·{" "}
                {d.observed_prior_escalation_decisions} earlier escalation
                decisions · {d.observed_recent_independent_escalations} recent
                independent escalations — {d.decision_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Independent closure proof exception aging and continuity
            confirmation
          </h2>
          <p>
            Separately review the owner replay-gap disposition, compare a
            source-linked owner disposition replay and confirm closure only when
            the database verifies the complete proof chain and no open peer
            exceptions remain. Follow-up reviews retain immutable due dates and
            escalation snapshots. No audit action releases operational holds or
            changes payments.
          </p>
          <h3>Owner disposition evidence queue</h3>
          <ul>
            {report.independentRecheckOwnerDecisions.map((d) => (
              <li key={d.id}>
                {d.id} · {d.proof_continuity_status} · {d.decision_kind}
                {d.next_due_at
                  ? ` · due ${new Date(d.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · closure confirmation pending"}
              </li>
            ))}
          </ul>
          <form action={recordIndependentProofContinuityReviewAction}>
            {pair}
            <label>
              Original owner evidence disposition{" "}
              <select name="ownerDecisionId" required defaultValue="">
                <option value="" disabled>
                  Choose an unreviewed owner disposition
                </option>
                {report.independentRecheckOwnerDecisions
                  .filter(
                    (d) =>
                      !report.independentProofContinuityReviews.some(
                        (r) => r.owner_decision_id === d.id,
                      ),
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.proof_continuity_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner disposition replay for comparison{" "}
              <select name="replayOwnerDecisionId" required defaultValue="">
                <option value="" disabled>
                  Choose original or newer disposition (same pair)
                </option>
                {report.independentRecheckOwnerDecisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} · {d.decision_kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Independent exception or closure outcome{" "}
              <select name="reviewKind" required>
                <option value="continue_exception_watch">
                  Continue timely exception watch
                </option>
                <option value="request_disposition_evidence">
                  Request refreshed disposition evidence
                </option>
                <option value="renew_independent_escalation">
                  Renew independent escalation
                </option>
                <option value="confirm_proof_continuity">
                  Confirm verified closure proof continuity
                </option>
              </select>
            </label>
            <p>
              Open exceptions need a future UTC follow-up within 90 days. Leave
              the date blank only when confirming the original closure proof. A
              separate reviewer is mandatory; overdue and renewed exceptions
              cannot be silently closed.
            </p>
            <label>
              Next independent follow-up due (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Source-linked proof evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent review rationale{" "}
              <textarea
                name="reviewNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.independentRecheckOwnerDecisions.some(
                  (d) =>
                    !report.independentProofContinuityReviews.some(
                      (r) => r.owner_decision_id === d.id,
                    ),
                )
              }
            >
              Record immutable independent continuity review
            </button>
          </form>
          <h3>Recorded independent review snapshots</h3>
          <ul>
            {report.independentProofContinuityReviews.map((r) => (
              <li key={r.id}>
                {r.review_kind} · owner {r.owner_decision_id} · replay{" "}
                {r.replay_owner_decision_id}
                {r.observed_replay_is_newer ? " (newer)" : " (original)"}
                {` · ${r.observed_owner_days_overdue} days overdue · ${r.observed_peer_open_owner_decisions} open peers · ${r.observed_peer_overdue_owner_decisions} overdue peers · ${r.observed_recent_escalation_renewals} recent escalations`}
                {r.observed_prior_chain_complete
                  ? " · proof chain complete"
                  : " · proof chain open"}
                {" — "}
                {r.review_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Independent recurrence monitoring, owner exception reopening &amp;
            audit follow-up
          </h2>
          <p>
            Closure confirmation is a point-in-time audit, not a permanent
            waiver. An independent reviewer can identify a recurring evidence
            gap; a separate owner must explicitly reopen it; and a third
            independent reviewer must verify new source-linked owner evidence or
            request further follow-up. Nothing here automatically changes holds,
            payments, transfers, or customer records.
          </p>
          <h3>Monitor previously confirmed proof continuity</h3>
          <form action={recordClosureRecurrenceEventAction}>
            {pair}
            <input
              type="hidden"
              name="eventKind"
              value="independent_recurrence_check"
            />
            <label>
              Verified independent proof review{" "}
              <select name="proofReviewId" required defaultValue="">
                <option value="" disabled>
                  Choose confirmed proof for independent monitoring
                </option>
                {report.independentProofContinuityReviews
                  .filter((r) => r.review_kind === "confirm_proof_continuity")
                  .map((r) => (
                    <option value={r.id} key={r.id}>
                      {r.id} · verified closure proof
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Recurrence finding{" "}
              <select name="outcomeKind" required>
                <option value="continuity_stable">
                  Proof continuity stable — monitor again
                </option>
                <option value="recurrence_gap">
                  Recurrent evidence gap — owner reopening needed
                </option>
                <option value="recurrence_escalated">
                  Escalated recurrence — owner escalation needed
                </option>
              </select>
            </label>
            <label>
              Next independent monitoring due (UTC){" "}
              <input type="date" name="nextDueAt" required />
            </label>
            <label>
              Source-linked evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent recurrence rationale{" "}
              <textarea
                name="eventNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.independentProofContinuityReviews.some(
                  (r) => r.review_kind === "confirm_proof_continuity",
                )
              }
            >
              Record independent recurrence check
            </button>
          </form>
          <h3>Owner exception reopening queue</h3>
          {report.closureRecurrenceEvents
            .filter(
              (e) =>
                e.event_kind === "independent_recurrence_check" &&
                e.outcome_kind !== "continuity_stable" &&
                !report.closureRecurrenceEvents.some(
                  (child) => child.prior_event_id === e.id,
                ),
            )
            .slice(0, 20)
            .map((e) => (
              <form key={e.id} action={recordClosureRecurrenceEventAction}>
                {pair}
                <input
                  type="hidden"
                  name="eventKind"
                  value="owner_exception_reopen"
                />
                <input type="hidden" name="priorEventId" value={e.id} />
                <input
                  type="hidden"
                  name="proofReviewId"
                  value={e.proof_review_id}
                />
                <p>
                  {e.id} · {e.recurrence_status} · {e.outcome_kind}
                </p>
                <label>
                  Owner reopening decision{" "}
                  <select name="outcomeKind" required>
                    <option value="reopen_evidence">
                      Reopen for refreshed owner evidence
                    </option>
                    <option value="reopen_escalation">
                      Reopen with explicit escalation renewal
                    </option>
                  </select>
                </label>
                <label>
                  Next owner follow-up due (UTC){" "}
                  <input type="date" name="nextDueAt" required />
                </label>
                <label>
                  Evidence reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Owner reopening rationale{" "}
                  <textarea
                    name="eventNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">Record immutable owner reopening</button>
              </form>
            ))}
          <h3>Independent audit follow-up after reopening</h3>
          {report.closureRecurrenceEvents
            .filter(
              (e) =>
                (e.event_kind === "owner_exception_reopen" ||
                  (e.event_kind === "independent_followup_verify" &&
                    e.outcome_kind !== "verify_followup_evidence")) &&
                !report.closureRecurrenceEvents.some(
                  (child) => child.prior_event_id === e.id,
                ),
            )
            .slice(0, 20)
            .map((e) => (
              <form key={e.id} action={recordClosureRecurrenceEventAction}>
                {pair}
                <input
                  type="hidden"
                  name="eventKind"
                  value="independent_followup_verify"
                />
                <input type="hidden" name="priorEventId" value={e.id} />
                <input
                  type="hidden"
                  name="proofReviewId"
                  value={e.proof_review_id}
                />
                <p>
                  Reopened exception / pending follow-up {e.id} ·{" "}
                  {e.recurrence_status} · {e.outcome_kind}
                </p>
                <label>
                  Independent follow-up finding{" "}
                  <select name="outcomeKind" required>
                    <option value="request_more_followup_evidence">
                      Request additional evidence
                    </option>
                    <option value="renew_followup_escalation">
                      Renew independent follow-up escalation
                    </option>
                    <option value="verify_followup_evidence">
                      Verify newer linked owner evidence (audit receipt only)
                    </option>
                  </select>
                </label>
                <label>
                  New owner evidence disposition (required only for verified
                  receipt){" "}
                  <select name="ownerEvidenceDecisionId" defaultValue="">
                    <option value="">No linked evidence yet</option>
                    {report.independentRecheckOwnerDecisions.map((d) => (
                      <option value={d.id} key={d.id}>
                        {d.id} · {d.decision_kind}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Next follow-up due (UTC; blank only when verified){" "}
                  <input type="date" name="nextDueAt" />
                </label>
                <label>
                  Verified source receipt/reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Independent follow-up rationale{" "}
                  <textarea
                    name="eventNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record independent follow-up result
                </button>
              </form>
            ))}
          <h3>Immutable recurrence, reopening and follow-up history</h3>
          <ul>
            {report.closureRecurrenceEvents.map((e) => (
              <li key={e.id}>
                {e.event_kind} · {e.outcome_kind} · {e.recurrence_status} ·
                proof {e.proof_review_id}
                {e.prior_event_id ? ` · follows ${e.prior_event_id}` : ""}
                {e.owner_evidence_decision_id
                  ? ` · linked owner ${e.owner_evidence_decision_id}`
                  : ""}
                {` · ${e.observed_prior_days_overdue} prior days overdue · ${e.observed_open_peer_recurrences} open recurrence peers · ${e.observed_open_owner_dispositions} open owner dispositions · ${e.observed_recent_owner_escalations} recent escalations`}
                {e.observed_original_proof_verified
                  ? " · original proof verified"
                  : " · proof incomplete"}
                {" — "}
                {e.event_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Reopened exception aging &amp; independent continuity oversight
          </h2>
          <p>
            Build 131 tracks how long a reopened evidence exception has waited,
            requires a separate reviewer to reassess its follow-up, and leaves a
            source-linked continuity recurrence audit trail. Verified audit
            receipts never release operational holds or change payments.
          </p>
          <h3>Independent reassessment of reopened owner evidence</h3>
          {report.closureRecurrenceEvents
            .filter(
              (e) =>
                e.event_kind === "owner_exception_reopen" &&
                !report.reopenedExceptionAgingReviews.some(
                  (r) =>
                    r.reopen_event_id === e.id &&
                    r.review_kind === "independent_followup_reassessment",
                ),
            )
            .slice(0, 20)
            .map((e) => (
              <form
                key={e.id}
                action={recordReopenedExceptionAgingReviewAction}
              >
                {pair}
                <input type="hidden" name="reopenEventId" value={e.id} />
                <input
                  type="hidden"
                  name="reviewKind"
                  value="independent_followup_reassessment"
                />
                <p>
                  Reopening {e.id} · {e.recurrence_status} · {e.outcome_kind}
                </p>
                <label>
                  Independent evidence aging outcome{" "}
                  <select name="outcomeKind" required>
                    <option value="evidence_gap_pending">
                      New evidence still pending
                    </option>
                    <option value="evidence_aging_escalated">
                      Escalate overdue or unresolved evidence
                    </option>
                    <option value="followup_evidence_reassessed">
                      Reassess independently verified follow-up evidence
                    </option>
                  </select>
                </label>
                <label>
                  Verified Build 130 follow-up receipt (for reassessed evidence
                  only){" "}
                  <select name="verifiedFollowupEventId" defaultValue="">
                    <option value="">No verified receipt yet</option>
                    {report.closureRecurrenceEvents
                      .filter(
                        (receipt) =>
                          receipt.root_reopen_id === e.id &&
                          receipt.outcome_kind === "verify_followup_evidence",
                      )
                      .map((receipt) => (
                        <option value={receipt.id} key={receipt.id}>
                          {receipt.id} · source-linked independent receipt
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Next independent review due (UTC){" "}
                  <input type="date" name="nextDueAt" required />
                </label>
                <label>
                  Evidence source reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Independent aging finding{" "}
                  <textarea
                    name="reviewNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record independent evidence reassessment
                </button>
              </form>
            ))}
          <h3>Independent closure continuity recurrence checks</h3>
          {report.reopenedExceptionAgingReviews
            .filter(
              (r) =>
                r.outcome_kind !== "continuity_recheck_verified" &&
                !report.reopenedExceptionAgingReviews.some(
                  (child) => child.prior_review_id === r.id,
                ),
            )
            .slice(0, 20)
            .map((r) => (
              <form
                key={r.id}
                action={recordReopenedExceptionAgingReviewAction}
              >
                {pair}
                <input
                  type="hidden"
                  name="reopenEventId"
                  value={r.reopen_event_id}
                />
                <input type="hidden" name="priorReviewId" value={r.id} />
                <input
                  type="hidden"
                  name="reviewKind"
                  value="continuity_recurrence_oversight"
                />
                <p>
                  Prior independent review {r.id} · {r.aging_status} ·{" "}
                  {r.observed_reopen_days_aging} days since reopening ·{" "}
                  {r.observed_prior_days_overdue} days overdue when recorded
                </p>
                <label>
                  Recurrence oversight outcome{" "}
                  <select name="outcomeKind" required>
                    <option value="continuity_watch_open">
                      Continue evidence continuity watch
                    </option>
                    <option value="recurrence_exception_detected">
                      Record new recurrence concern
                    </option>
                    <option value="continuity_escalation_renewed">
                      Renew independent escalation
                    </option>
                    <option value="continuity_recheck_verified">
                      Independently verify source-linked continuity
                    </option>
                  </select>
                </label>
                <label>
                  Verified Build 130 receipt (only for verified closure){" "}
                  <select name="verifiedFollowupEventId" defaultValue="">
                    <option value="">No verified receipt yet</option>
                    {report.closureRecurrenceEvents
                      .filter(
                        (receipt) =>
                          receipt.root_reopen_id === r.reopen_event_id &&
                          receipt.outcome_kind === "verify_followup_evidence",
                      )
                      .map((receipt) => (
                        <option value={receipt.id} key={receipt.id}>
                          {receipt.id} · independent follow-up proof
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Next monitoring due (UTC; blank only when verified){" "}
                  <input type="date" name="nextDueAt" />
                </label>
                <label>
                  Evidence source reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Independent oversight rationale{" "}
                  <textarea
                    name="reviewNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record continuity recurrence oversight
                </button>
              </form>
            ))}
          <h3>
            Build 132 independent recurrence recheck, overdue resolution &amp;
            verified closure follow-up
          </h3>
          <p>
            Complete independent rechecks first, document overdue resolution
            next, and only then verify closure follow-up. A different reviewer
            must sign each successive receipt. Evidence and audit closure never
            release a real hold. Select a verified Build 130 receipt only for a
            verified outcome, and leave the next date empty only for final
            verified closure.
          </p>
          {resolutionQueue.slice(0, 20).map((item) => {
            const reopenId = report.reopenedExceptionAgingReviews.find(
              (r) => r.id === item.agingReviewId,
            )?.reopen_event_id;
            return (
              <form
                key={item.id}
                action={recordContinuityResolutionFollowupAction}
              >
                {pair}
                <input
                  type="hidden"
                  name="agingReviewId"
                  value={item.agingReviewId}
                />
                <input
                  type="hidden"
                  name="priorFollowupId"
                  value={item.priorFollowupId}
                />
                <input
                  type="hidden"
                  name="followupKind"
                  value={item.followupKind}
                />
                <p>
                  {item.followupKind} · {item.status} · review {item.id}
                </p>
                <label>
                  Independent decision outcome{" "}
                  <select name="outcomeKind" required>
                    {resolutionOptions[item.followupKind].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Verified same-reopening follow-up receipt (verified outcomes
                  only){" "}
                  <select name="verifiedFollowupEventId" defaultValue="">
                    <option value="">No verified receipt</option>
                    {report.closureRecurrenceEvents
                      .filter(
                        (e) =>
                          e.root_reopen_id === reopenId &&
                          e.outcome_kind === "verify_followup_evidence",
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.id}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Next review due (UTC; blank for verified closure only){" "}
                  <input type="date" name="nextDueAt" />
                </label>
                <label>
                  Source evidence reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Independent resolution / closure reasoning{" "}
                  <textarea
                    name="followupNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record independent Build 132 follow-up
                </button>
              </form>
            );
          })}
          <h3>Immutable independent continuity resolution history</h3>
          <ul>
            {report.continuityResolutionFollowups.map((r) => (
              <li key={r.id}>
                {r.followup_kind} · {r.outcome_kind} · {r.resolution_status}
                {` · aging ${r.aging_review_id} · ${r.observed_prior_days_overdue} days overdue · ${r.observed_open_peer_recurrences} unresolved recurrence peers · ${r.observed_open_owner_dispositions} open owner dispositions · ${r.observed_recent_owner_escalations} recent escalations`}
                {r.verified_followup_event_id
                  ? ` · evidence ${r.verified_followup_event_id}`
                  : ""}
                {r.prior_followup_id ? ` · follows ${r.prior_followup_id}` : ""}
                {" — "}
                {r.followup_note}
              </li>
            ))}
          </ul>
          <h3>Immutable reopened exception aging and continuity history</h3>
          <ul>
            {report.reopenedExceptionAgingReviews.map((r) => (
              <li key={r.id}>
                {r.review_kind} · {r.outcome_kind} · {r.aging_status} · reopened{" "}
                {r.reopen_event_id}
                {r.prior_review_id ? ` · follows ${r.prior_review_id}` : ""}
                {r.verified_followup_event_id
                  ? ` · verified receipt ${r.verified_followup_event_id}`
                  : ""}
                {` · ${r.observed_reopen_days_aging} reopening days · ${r.observed_prior_days_overdue} prior days overdue · ${r.observed_open_peer_recurrences} unresolved recurrence peers · ${r.observed_open_owner_dispositions} open owner dispositions · ${r.observed_recent_owner_escalations} recent owner escalations`}
                {r.observed_verified_followup_linked
                  ? " · source-linked evidence verified"
                  : " · evidence still under review"}
                {" — "}
                {r.review_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Build 133 — Verified closure recurrence monitoring &amp; evidence
            renewal
          </h2>
          <p>
            We recheck an independently verified closure, renew evidence through
            a separate reviewer, then audit any overdue owner reopening. This is
            an immutable iCamp owner record—not an operational case release or a
            request to another application. A linked reopening must be a real,
            newer Build 130 owner event from these same campgrounds.
          </p>
          <h3>Independent recurrence, renewal &amp; overdue reopening queue</h3>
          {closureMonitorQueue.slice(0, 20).map((item) => {
            const closure = report.continuityResolutionFollowups.find(
              (r) => r.id === item.closureFollowupId,
            );
            return (
              <form key={item.id} action={recordVerifiedClosureMonitorAction}>
                {pair}
                <input
                  type="hidden"
                  name="closureFollowupId"
                  value={item.closureFollowupId}
                />
                <input
                  type="hidden"
                  name="priorMonitorId"
                  value={item.priorMonitorId}
                />
                <input
                  type="hidden"
                  name="monitorKind"
                  value={item.monitorKind}
                />
                <p>
                  {item.monitorKind} · {item.status} · source {item.id}
                </p>
                <label>
                  Independent audit outcome{" "}
                  <select name="outcomeKind" required>
                    {verifiedClosureOptions[item.monitorKind].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Verified newer owner reopening event (only for linked
                  reopening){" "}
                  <select name="linkedReopenEventId" defaultValue="">
                    <option value="">No verified reopening to link</option>
                    {report.closureRecurrenceEvents
                      .filter(
                        (e) =>
                          e.event_kind === "owner_exception_reopen" &&
                          closure &&
                          new Date(e.recorded_at).getTime() >
                            new Date(closure.recorded_at).getTime(),
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.id} · owner reopened
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Next independent review due (UTC; blank only for linked
                  reopening) <input type="date" name="nextDueAt" />
                </label>
                <label>
                  Source evidence / renewal reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Independent recurrence, renewal or reopening findings{" "}
                  <textarea
                    name="monitorNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record Build 133 independent audit
                </button>
              </form>
            );
          })}
          <h3>Immutable verified closure monitoring history</h3>
          <ul>
            {report.verifiedClosureMonitors.map((r) => (
              <li key={r.id}>
                {r.monitor_kind} · {r.outcome_kind} · {r.monitoring_status}
                {` · closure ${r.closure_followup_id} · source proof ${r.observed_proof_age_days} days old · prior ${r.observed_prior_days_overdue} days overdue · ${r.observed_open_peer_recurrences} open peer recurrences · ${r.observed_open_owner_dispositions} open owner decisions · ${r.observed_recent_owner_escalations} recent escalations`}
                {r.linked_reopen_event_id
                  ? ` · verified reopening ${r.linked_reopen_event_id}`
                  : ""}
                {r.prior_monitor_id ? ` · follows ${r.prior_monitor_id}` : ""}
                {" — "}
                {r.monitor_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Build 134 — Independent reopening follow-up, decision replay &amp;
            owner escalation oversight
          </h2>
          <p>
            This audit begins only after Build 133 independently links a real
            owner reopening. Each follow-up passes to a different reviewer,
            compares the original same-campground evidence, and escalates
            overdue discrepancies. Source-linked resolution must reference a
            real, independent Build 130 follow-up for that exact reopening.
            These receipts do not release holds or contact another business.
          </p>
          <h3>Reopening evidence aging and independent replay queue</h3>
          {reopeningOversightQueue.slice(0, 20).map((item) => {
            const monitor = report.verifiedClosureMonitors.find(
              (r) => r.id === item.verifiedMonitorId,
            );
            return (
              <form
                key={item.id}
                action={recordReopeningFollowupOversightAction}
              >
                {pair}
                <input
                  type="hidden"
                  name="verifiedMonitorId"
                  value={item.verifiedMonitorId}
                />
                <input
                  type="hidden"
                  name="priorOversightId"
                  value={item.priorOversightId}
                />
                <input
                  type="hidden"
                  name="oversightKind"
                  value={item.oversightKind}
                />
                <p>
                  {item.oversightKind} · {item.status} · receipt {item.id}
                </p>
                <label>
                  Independent follow-up outcome{" "}
                  <select name="outcomeKind" required>
                    {reopeningOversightOptions[item.oversightKind].map(
                      (option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Verified source resolution (only for confirmed replay or
                  resolved escalation){" "}
                  <select name="verifiedResolutionEventId" defaultValue="">
                    <option value="">No verified resolution link</option>
                    {report.closureRecurrenceEvents
                      .filter(
                        (e) =>
                          e.event_kind === "independent_followup_verify" &&
                          e.outcome_kind === "verify_followup_evidence" &&
                          monitor &&
                          e.root_reopen_id === monitor.linked_reopen_event_id,
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.id} · independent source proof
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Next independent review due (UTC; blank only for resolved
                  owner escalation) <input name="nextDueAt" type="date" />
                </label>
                <label>
                  Source evidence and decision replay reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Reopening aging, independent replay or owner oversight
                  findings{" "}
                  <textarea
                    name="oversightNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record Build 134 independent follow-up
                </button>
              </form>
            );
          })}
          <h3>Immutable reopening oversight and escalation history</h3>
          <ul>
            {report.reopeningFollowupOversights.map((r) => (
              <li key={r.id}>
                {r.oversight_kind} · {r.outcome_kind} · {r.oversight_status}
                {` · reopening ${r.verified_monitor_id} · ${r.observed_reopen_age_days} reopening days aged · ${r.observed_prior_days_overdue} overdue days · ${r.observed_open_peer_recurrences} open peer recurrences · ${r.observed_open_owner_dispositions} open owner decisions · ${r.observed_recent_owner_escalations} recent owner escalations`}
                {r.verified_resolution_event_id
                  ? ` · verified source resolution ${r.verified_resolution_event_id}`
                  : ""}
                {r.prior_oversight_id
                  ? ` · follows ${r.prior_oversight_id}`
                  : ""}
                {" — "}
                {r.oversight_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Build 135 — Independent escalation resolution follow-up, reopening
            recurrence watch &amp; owner evidence renewal
          </h2>
          <p>
            A new independent audit begins only after Build 134 verifies an
            owner escalation resolution. Follow-up, recurrence watch and owner
            renewal are recorded in order with independent reviewers. A stable
            result requires new same-reopening source proof, not recycled
            closure evidence. Later owner reopenings and unresolved peer/owner
            exceptions block stable results; overdue proof must be explicitly
            escalated. These receipts never release campground holds or send
            messages.
          </p>
          <h3>Verified resolution follow-up and renewal queue</h3>
          {escalationRenewalQueue.slice(0, 20).map((item) => {
            const resolved = report.reopeningFollowupOversights.find(
              (r) => r.id === item.resolvedOversightId,
            );
            const monitor = report.verifiedClosureMonitors.find(
              (r) => r.id === resolved?.verified_monitor_id,
            );
            const baseline = report.closureRecurrenceEvents.find(
              (e) => e.id === resolved?.verified_resolution_event_id,
            );
            return (
              <form
                key={item.id}
                action={recordEscalationResolutionRenewalAction}
              >
                {pair}
                <input
                  type="hidden"
                  name="resolvedOversightId"
                  value={item.resolvedOversightId}
                />
                <input
                  type="hidden"
                  name="priorRenewalId"
                  value={item.priorRenewalId}
                />
                <input
                  type="hidden"
                  name="renewalKind"
                  value={item.renewalKind}
                />
                <p>
                  {item.renewalKind} · {item.status} · receipt {item.id}
                </p>
                <label>
                  Independent renewal outcome{" "}
                  <select name="outcomeKind" required>
                    {escalationRenewalOptions[item.renewalKind].map(
                      (option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  New same-root source proof (required for current, stable or
                  renewed outcome){" "}
                  <select name="renewalEvidenceEventId" defaultValue="">
                    <option value="">No independently renewed proof yet</option>
                    {report.closureRecurrenceEvents
                      .filter(
                        (event) =>
                          event.event_kind === "independent_followup_verify" &&
                          event.outcome_kind === "verify_followup_evidence" &&
                          event.root_reopen_id ===
                            monitor?.linked_reopen_event_id &&
                          baseline &&
                          new Date(event.recorded_at).getTime() >
                            new Date(baseline.recorded_at).getTime() &&
                          !report.escalationResolutionRenewals.some(
                            (used) =>
                              used.renewal_evidence_event_id === event.id,
                          ),
                      )
                      .map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.id} · fresh independent source evidence
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Next independent renewal due (UTC, within 90 days){" "}
                  <input name="nextDueAt" type="date" required />
                </label>
                <label>
                  Source evidence reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Resolution follow-up, recurrence and owner renewal findings{" "}
                  <textarea
                    name="renewalNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record Build 135 independent renewal
                </button>
              </form>
            );
          })}
          <h3>Immutable escalation resolution and renewal history</h3>
          <ul>
            {report.escalationResolutionRenewals.map((record) => (
              <li key={record.id}>
                {record.renewal_kind} · {record.outcome_kind} ·{" "}
                {record.renewal_status}
                {` · resolved escalation ${record.resolved_oversight_id} · ${record.observed_resolution_age_days} days since resolution · ${record.observed_prior_days_overdue} days overdue · ${record.observed_new_reopenings} newer reopenings · ${record.observed_open_peer_recurrences} open peer recurrences · ${record.observed_open_owner_dispositions} open owner decisions · ${record.observed_recent_owner_escalations} recent escalations`}
                {record.renewal_evidence_event_id
                  ? ` · independent fresh proof ${record.renewal_evidence_event_id}`
                  : ""}
                {record.prior_renewal_id
                  ? ` · follows ${record.prior_renewal_id}`
                  : ""}
                {" — "}
                {record.renewal_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Build 136 — Independent renewal evidence freshness, reopening watch
            exceptions &amp; owner continuity decision
          </h2>
          <p>
            Each review compares a Build 135 owner renewal against its verified
            source proof. Only a new, separately verified proof can be marked
            fresh. A distinct reviewer then rechecks later reopenings and open
            peer/owner exceptions before the owner continuity decision. Thirty
            days overdue requires escalation, and the audit never changes
            campground holds, reservations, customers or outside applications.
          </p>
          <h3>Freshness comparison and independent reassessment queue</h3>
          {renewalFreshnessQueue.slice(0, 20).map((item) => {
            const ownerRenewal = report.escalationResolutionRenewals.find(
              (r) => r.id === item.ownerRenewalId,
            );
            const resolved = report.reopeningFollowupOversights.find(
              (r) => r.id === ownerRenewal?.resolved_oversight_id,
            );
            const monitor = report.verifiedClosureMonitors.find(
              (r) => r.id === resolved?.verified_monitor_id,
            );
            const baseline = report.closureRecurrenceEvents.find(
              (r) =>
                r.id ===
                (ownerRenewal?.renewal_evidence_event_id ??
                  resolved?.verified_resolution_event_id),
            );
            return (
              <form key={item.id} action={recordRenewalFreshnessDecisionAction}>
                {pair}
                <input
                  type="hidden"
                  name="ownerRenewalId"
                  value={item.ownerRenewalId}
                />
                <input
                  type="hidden"
                  name="priorAuditId"
                  value={item.priorAuditId}
                />
                <input type="hidden" name="auditKind" value={item.auditKind} />
                <p>
                  {item.auditKind} · {item.status} · receipt {item.id}
                </p>
                <label>
                  Independent audit outcome{" "}
                  <select name="outcomeKind" required>
                    {renewalFreshnessOptions[item.auditKind].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Newer verified source evidence (only for freshness verified){" "}
                  <select name="comparisonEvidenceEventId" defaultValue="">
                    <option value="">No new source evidence to claim</option>
                    {item.auditKind ===
                      "independent_renewal_freshness_comparison" &&
                      report.closureRecurrenceEvents
                        .filter(
                          (event) =>
                            event.event_kind ===
                              "independent_followup_verify" &&
                            event.outcome_kind === "verify_followup_evidence" &&
                            event.root_reopen_id ===
                              monitor?.linked_reopen_event_id &&
                            baseline &&
                            new Date(event.recorded_at).getTime() >
                              new Date(baseline.recorded_at).getTime() &&
                            !report.renewalFreshnessDecisions.some(
                              (used) =>
                                used.comparison_evidence_event_id === event.id,
                            ),
                        )
                        .map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.id} · later independent source proof
                          </option>
                        ))}
                  </select>
                </label>
                <label>
                  Next UTC continuity audit due (within 90 days){" "}
                  <input type="date" name="nextDueAt" required />
                </label>
                <label>
                  Evidence reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Freshness comparison, exception recheck or owner decision
                  findings{" "}
                  <textarea
                    name="auditNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record Build 136 independent audit
                </button>
              </form>
            );
          })}
          <h3>Immutable renewal freshness and continuity decision history</h3>
          <ul>
            {report.renewalFreshnessDecisions.map((record) => (
              <li key={record.id}>
                {record.audit_kind} · {record.outcome_kind} ·{" "}
                {record.audit_status}
                {` · owner renewal ${record.owner_renewal_id} · ${record.observed_proof_age_days} evidence days old · ${record.observed_prior_days_overdue} overdue days · ${record.observed_new_reopenings} later reopenings · ${record.observed_open_peer_recurrences} peer exceptions · ${record.observed_open_owner_dispositions} owner exceptions · ${record.observed_recent_owner_escalations} recent escalations`}
                {record.comparison_evidence_event_id
                  ? ` · verified new proof ${record.comparison_evidence_event_id}`
                  : ""}
                {record.prior_audit_id
                  ? ` · follows ${record.prior_audit_id}`
                  : ""}
                {" — "}
                {record.audit_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Build 137 — Continuity recurrence watch, renewal exception aging and
            verified owner audit recheck
          </h2>
          <p>
            Recheck the Build 136 owner continuity decision independently, then
            record whether renewal exceptions are overdue. Reverify an owner
            audit only with a newer same-root source event, a different reviewer
            and no unresolved recurrence or owner exception. Thirty-day overdue
            reviews require explicit exception or escalation. All receipts are
            immutable; none releases holds or sends messages to other systems.
          </p>
          <h3>Independent recurrence and owner audit queue</h3>
          {continuityRecheckQueue.slice(0, 20).map((item) => {
            const owner = report.renewalFreshnessDecisions.find(
              (r) => r.id === item.ownerContinuityId,
            );
            const watch = report.renewalFreshnessDecisions.find(
              (r) => r.id === owner?.prior_audit_id,
            );
            const comparison = report.renewalFreshnessDecisions.find(
              (r) => r.id === watch?.prior_audit_id,
            );
            const baseline = report.closureRecurrenceEvents.find(
              (r) => r.id === comparison?.comparison_evidence_event_id,
            );
            return (
              <form
                key={item.id}
                action={recordContinuityRecurrenceRecheckAction}
              >
                {pair}
                <input
                  type="hidden"
                  name="ownerContinuityId"
                  value={item.ownerContinuityId}
                />
                <input
                  type="hidden"
                  name="priorRecheckId"
                  value={item.priorRecheckId}
                />
                <input
                  type="hidden"
                  name="recheckKind"
                  value={item.recheckKind}
                />
                <p>
                  {item.recheckKind} · {item.status} · source receipt {item.id}
                </p>
                <label>
                  Independent recheck outcome{" "}
                  <select name="outcomeKind" required>
                    {continuityRecheckOptions[item.recheckKind].map(
                      (option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  New independent source proof (only for verified owner audit){" "}
                  <select name="verifiedFollowupEventId" defaultValue="">
                    <option value="">No new verified proof claimed</option>
                    {item.recheckKind === "verified_owner_audit_recheck" &&
                      report.closureRecurrenceEvents
                        .filter(
                          (event) =>
                            event.event_kind ===
                              "independent_followup_verify" &&
                            event.outcome_kind === "verify_followup_evidence" &&
                            event.observed_original_proof_verified &&
                            baseline &&
                            event.root_reopen_id === baseline.root_reopen_id &&
                            new Date(event.recorded_at).getTime() >
                              new Date(baseline.recorded_at).getTime() &&
                            !report.continuityRecurrenceRechecks.some(
                              (used) =>
                                used.verified_followup_event_id === event.id,
                            ),
                        )
                        .map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.id} · newer verified same-root evidence
                          </option>
                        ))}
                  </select>
                </label>
                <label>
                  Next independent UTC recheck date (within 90 days){" "}
                  <input type="date" name="nextDueAt" required />
                </label>
                <label>
                  Evidence reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Recurrence, renewal age or owner audit findings{" "}
                  <textarea
                    name="recheckNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record Build 137 independent recheck
                </button>
              </form>
            );
          })}
          <h3>Immutable independent continuity recheck history</h3>
          <ul>
            {report.continuityRecurrenceRechecks.map((record) => (
              <li key={record.id}>
                {record.recheck_kind} · {record.outcome_kind} ·{" "}
                {record.recheck_status}
                {` · owner decision ${record.owner_continuity_id} · source proof ${record.observed_proof_age_days} days old · ${record.observed_prior_days_overdue} overdue days · ${record.observed_new_reopenings} newer reopenings · ${record.observed_open_peer_recurrences} peer recurrences · ${record.observed_open_owner_dispositions} owner dispositions · ${record.observed_recent_owner_escalations} escalations · ${record.observed_open_renewal_exceptions} renewal exceptions · ${record.observed_overdue_renewal_reviews} overdue renewals`}
                {record.verified_followup_event_id
                  ? ` · verified source proof ${record.verified_followup_event_id}`
                  : ""}
                {record.prior_recheck_id
                  ? ` · follows ${record.prior_recheck_id}`
                  : ""}
                {" — "}
                {record.recheck_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Build 138 — Independent owner recheck renewal, overdue exception
            disposition &amp; continuity evidence watch
          </h2>
          <p>
            Start with an existing Build 137 owner audit recheck. An independent
            reviewer records recurrence findings, then the overdue exception
            disposition, followed by another source-linked evidence watch.
            Positive findings need current verified evidence and no open
            owner/peer exceptions. A new same-root proof must be independently
            verified for a positive continuity watch. Thirty-day overdue
            follow-ups require explicit exception or escalation. Nothing here
            releases a hold, changes customer data or dispatches other systems.
          </p>
          <h3>Owner recheck renewal and exception disposition queue</h3>
          {ownerRecheckRenewalQueue.slice(0, 20).map((item) => {
            const ownerRecheck = report.continuityRecurrenceRechecks.find(
              (r) => r.id === item.ownerRecheckId,
            );
            const ownerContinuity = report.renewalFreshnessDecisions.find(
              (r) => r.id === ownerRecheck?.owner_continuity_id,
            );
            const ownerWatch = report.renewalFreshnessDecisions.find(
              (r) => r.id === ownerContinuity?.prior_audit_id,
            );
            const comparison = report.renewalFreshnessDecisions.find(
              (r) => r.id === ownerWatch?.prior_audit_id,
            );
            const baseline = report.closureRecurrenceEvents.find(
              (r) =>
                r.id ===
                (ownerRecheck?.verified_followup_event_id ??
                  comparison?.comparison_evidence_event_id),
            );
            const priorProofTimes = report.ownerRecheckRenewalWatches
              .filter((r) => r.owner_recheck_id === item.ownerRecheckId)
              .flatMap((r) =>
                report.closureRecurrenceEvents.filter(
                  (event) => event.id === r.verified_evidence_event_id,
                ),
              )
              .map((event) => new Date(event.recorded_at).getTime());
            const latestProofTime = Math.max(
              baseline ? new Date(baseline.recorded_at).getTime() : 0,
              ...priorProofTimes,
            );
            return (
              <form key={item.id} action={recordOwnerRecheckRenewalWatchAction}>
                {pair}
                <input
                  type="hidden"
                  name="ownerRecheckId"
                  value={item.ownerRecheckId}
                />
                <input
                  type="hidden"
                  name="priorWatchId"
                  value={item.priorWatchId}
                />
                <input type="hidden" name="watchKind" value={item.watchKind} />
                <p>
                  {item.watchKind} · {item.status} · source receipt {item.id}
                </p>
                <label>
                  Independent renewal / disposition outcome{" "}
                  <select name="outcomeKind" required>
                    {ownerRecheckRenewalOptions[item.watchKind].map(
                      (option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Newer verified same-root evidence (only for verified
                  continuity){" "}
                  <select name="verifiedEvidenceEventId" defaultValue="">
                    <option value="">No fresh source evidence claimed</option>
                    {item.watchKind === "continuity_evidence_watch" &&
                      report.closureRecurrenceEvents
                        .filter(
                          (event) =>
                            event.event_kind ===
                              "independent_followup_verify" &&
                            event.outcome_kind === "verify_followup_evidence" &&
                            event.observed_original_proof_verified &&
                            baseline &&
                            event.root_reopen_id === baseline.root_reopen_id &&
                            new Date(event.recorded_at).getTime() >
                              latestProofTime &&
                            !report.ownerRecheckRenewalWatches.some(
                              (used) =>
                                used.verified_evidence_event_id === event.id,
                            ),
                        )
                        .map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.id} · later independently verified proof
                          </option>
                        ))}
                  </select>
                </label>
                <label>
                  Next independent UTC follow-up date (within 90 days){" "}
                  <input type="date" name="nextDueAt" required />
                </label>
                <label>
                  Evidence reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Recurrence, exception or continuity evidence findings{" "}
                  <textarea
                    name="watchNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record Build 138 independent renewal watch
                </button>
              </form>
            );
          })}
          <h3>Immutable owner recheck renewal and continuity history</h3>
          <ul>
            {report.ownerRecheckRenewalWatches.map((record) => (
              <li key={record.id}>
                {record.watch_kind} · {record.outcome_kind} ·{" "}
                {record.watch_status}
                {` · owner recheck ${record.owner_recheck_id} · ${record.observed_days_since_owner_recheck} days since audit · ${record.observed_prior_days_overdue} overdue days · proof ${record.observed_evidence_age_days} days old · ${record.observed_new_reopenings} new reopenings · ${record.observed_open_peer_recurrences} peer recurrences · ${record.observed_open_owner_dispositions} owner dispositions · ${record.observed_open_recheck_exceptions} recheck exceptions · ${record.observed_overdue_owner_rechecks} overdue owner rechecks`}
                {record.verified_evidence_event_id
                  ? ` · independent proof ${record.verified_evidence_event_id}`
                  : ""}
                {record.prior_watch_id
                  ? ` · follows ${record.prior_watch_id}`
                  : ""}
                {" — "}
                {record.watch_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Build 139 — Continuity evidence recurrence, aging exception &amp;
            owner audit proof reconciliation
          </h2>
          <p>
            Independently review a Build 138 continuity watch, follow up actual
            exception aging, then reconcile the owner audit against a newer,
            separately verified same-root source record. All decisions remain
            campground-isolated and immutable; unresolved evidence stays open.
            No hold release, guest data, reservation mutation or gate command.
          </p>
          <h3>Independent review queue</h3>
          {evidenceReconciliationQueue.slice(0, 20).map((item) => {
            const base = report.ownerRecheckRenewalWatches.find(
              (r) => r.id === item.continuityWatchId,
            );
            const original = report.closureRecurrenceEvents.find(
              (r) => r.id === base?.verified_evidence_event_id,
            );
            return (
              <form
                key={item.id}
                action={recordContinuityEvidenceReconciliationAction}
              >
                {pair}
                <input
                  type="hidden"
                  name="continuityWatchId"
                  value={item.continuityWatchId}
                />
                <input
                  type="hidden"
                  name="priorReconciliationId"
                  value={item.priorReconciliationId}
                />
                <input
                  type="hidden"
                  name="reviewKind"
                  value={item.reviewKind}
                />
                <p>
                  {item.reviewKind} · {item.status} · prior source {item.id}
                </p>
                <label>
                  Independent review outcome{" "}
                  <select name="outcomeKind" required>
                    {evidenceReconciliationOutcomes[item.reviewKind].map(
                      (option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  New independent owner proof (only for reconciled outcome){" "}
                  <select name="verifiedSourceEventId" defaultValue="">
                    <option value="">No new verified proof</option>
                    {item.reviewKind === "owner_audit_proof_reconciliation" &&
                      report.closureRecurrenceEvents
                        .filter(
                          (event) =>
                            original &&
                            event.root_reopen_id === original.root_reopen_id &&
                            event.event_kind ===
                              "independent_followup_verify" &&
                            event.outcome_kind === "verify_followup_evidence" &&
                            event.observed_original_proof_verified &&
                            new Date(event.recorded_at).getTime() >
                              new Date(original.recorded_at).getTime() &&
                            !report.continuityEvidenceReconciliations.some(
                              (used) =>
                                used.verified_source_event_id === event.id,
                            ),
                        )
                        .map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.id} · later verified proof
                          </option>
                        ))}
                  </select>
                </label>
                <label>
                  Next independent UTC review date (within 90 days){" "}
                  <input type="date" name="nextDueAt" required />
                </label>
                <label>
                  Evidence reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Source recurrence, aging or owner reconciliation findings{" "}
                  <textarea
                    name="reviewNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record Build 139 independent evidence review
                </button>
              </form>
            );
          })}
          <h3>Immutable independent recurrence and owner proof receipts</h3>
          <ul>
            {report.continuityEvidenceReconciliations.map((record) => (
              <li key={record.id}>
                {record.review_kind} · {record.outcome_kind} ·{" "}
                {record.reconciliation_status}
                {` · Build 138 watch ${record.continuity_watch_id} · watch age ${record.observed_watch_age_days} days · prior overdue ${record.observed_prior_overdue_days} days · proof age ${record.observed_proof_age_days} days · new reopenings ${record.observed_later_reopenings} · peer recurrences ${record.observed_open_peer_recurrences} · owner dispositions ${record.observed_open_owner_dispositions} · renewal exceptions ${record.observed_open_renewal_exceptions} · overdue renewal watches ${record.observed_overdue_renewal_watches}`}
                {record.verified_source_event_id
                  ? ` · new independent source ${record.verified_source_event_id}`
                  : ""}
                {record.prior_reconciliation_id
                  ? ` · follows ${record.prior_reconciliation_id}`
                  : ""}
                {" — "}
                {record.review_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Build 140 — Independent owner proof renewal, aged exception
            disposition &amp; cross-system read-only gate
          </h2>
          <p>
            Follow a Build 139 owner proof reconciliation through independent
            renewal, observed aging disposition, and a documentary integration
            gate review. Newer independently verified same-root evidence is
            required for a current renewal. Cross-system source IDs are
            references, not independent signature verification or owner
            authorization. The gateway, customer records, reservations, messages
            and gate controls remain DISCONNECTED / HOLD.
          </p>
          <h3>Owner proof and read-only HOLD queue</h3>
          {ownerProofGatewayQueue.slice(0, 20).map((item) => {
            const base = report.continuityEvidenceReconciliations.find(
              (r) => r.id === item.ownerReconciliationId,
            );
            const original = report.closureRecurrenceEvents.find(
              (r) => r.id === base?.verified_source_event_id,
            );
            const latest = Math.max(
              original ? new Date(original.recorded_at).getTime() : 0,
              ...report.ownerProofGatewayReviews
                .filter(
                  (r) =>
                    r.owner_reconciliation_id === item.ownerReconciliationId,
                )
                .flatMap((r) =>
                  report.closureRecurrenceEvents.filter(
                    (event) => event.id === r.verified_renewal_event_id,
                  ),
                )
                .map((event) => new Date(event.recorded_at).getTime()),
            );
            return (
              <form key={item.id} action={recordOwnerProofGatewayReviewAction}>
                {pair}
                <input
                  type="hidden"
                  name="ownerReconciliationId"
                  value={item.ownerReconciliationId}
                />
                <input
                  type="hidden"
                  name="priorReviewId"
                  value={item.priorReviewId}
                />
                <input
                  type="hidden"
                  name="reviewKind"
                  value={item.reviewKind}
                />
                <p>
                  {item.reviewKind} · {item.status} · root receipt {item.id}
                </p>
                <label>
                  Independent review outcome{" "}
                  <select name="outcomeKind" required>
                    {ownerProofGateOptions[item.reviewKind].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Newer verified same-root proof (required for current renewal){" "}
                  <select name="verifiedRenewalEventId" defaultValue="">
                    <option value="">No new proof claimed</option>
                    {item.reviewKind === "independent_owner_proof_renewal" &&
                      report.closureRecurrenceEvents
                        .filter(
                          (e) =>
                            original &&
                            e.root_reopen_id === original.root_reopen_id &&
                            e.event_kind === "independent_followup_verify" &&
                            e.outcome_kind === "verify_followup_evidence" &&
                            e.observed_original_proof_verified &&
                            new Date(e.recorded_at).getTime() > latest &&
                            !report.ownerProofGatewayReviews.some(
                              (used) => used.verified_renewal_event_id === e.id,
                            ),
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.id} · independently verified source
                          </option>
                        ))}
                  </select>
                </label>
                {item.reviewKind === "cross_system_read_only_gate_review" && (
                  <>
                    <p>
                      Optional reference IDs only; no passwords, API keys,
                      tokens, URLs, personal data or invented evidence. All four
                      are required only for a documented HOLD review. They do
                      not authorize a pilot.
                    </p>
                    <label>
                      Gateway signed health receipt ID{" "}
                      <input
                        name="gatewayHealthReceiptRef"
                        minLength={8}
                        maxLength={160}
                        pattern="[A-Za-z0-9._:-]{8,160}"
                      />
                    </label>
                    <label>
                      Gateway signed capabilities receipt ID{" "}
                      <input
                        name="gatewayCapabilitiesReceiptRef"
                        minLength={8}
                        maxLength={160}
                        pattern="[A-Za-z0-9._:-]{8,160}"
                      />
                    </label>
                    <label>
                      Independent durable gateway audit ID{" "}
                      <input
                        name="gatewayAuditReceiptRef"
                        minLength={8}
                        maxLength={160}
                        pattern="[A-Za-z0-9._:-]{8,160}"
                      />
                    </label>
                    <label>
                      Separately witnessed owner identity attestation ID{" "}
                      <input
                        name="independentWitnessAttestationRef"
                        minLength={8}
                        maxLength={160}
                        pattern="[A-Za-z0-9._:-]{8,160}"
                      />
                    </label>
                  </>
                )}
                <label>
                  Next independent UTC review (within 90 days){" "}
                  <input type="date" name="nextDueAt" required />
                </label>
                <label>
                  Evidence reference{" "}
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={400}
                    required
                  />
                </label>
                <label>
                  Renewal, aging or gateway HOLD findings{" "}
                  <textarea
                    name="reviewNote"
                    minLength={12}
                    maxLength={800}
                    required
                  />
                </label>
                <button type="submit">
                  Record Build 140 owner-safe review
                </button>
              </form>
            );
          })}
          <h3>Immutable proof renewal and cross-system HOLD history</h3>
          <ul>
            {report.ownerProofGatewayReviews.map((record) => (
              <li key={record.id}>
                {record.review_kind} · {record.outcome_kind} ·{" "}
                {record.review_status}
                {` · gate ${record.gate_state} · owner pilot ${record.owner_pilot_authorized ? "authorized" : "not authorized"} · dispatch ${record.dispatch_enabled ? "enabled" : "disabled"} · Build 139 receipt ${record.owner_reconciliation_id} · reconciliation age ${record.observed_reconciliation_age_days} days · prior overdue ${record.observed_prior_overdue_days} days · proof age ${record.observed_proof_age_days} days · later reopenings ${record.observed_later_reopenings} · peer recurrences ${record.observed_open_peer_recurrences} · owner dispositions ${record.observed_open_owner_dispositions} · open Build 139 exceptions ${record.observed_open_139_exceptions} · overdue Build 139 reviews ${record.observed_overdue_139_reviews}`}
                {record.verified_renewal_event_id
                  ? ` · newer proof ${record.verified_renewal_event_id}`
                  : ""}
                {record.observed_gateway_metadata_complete
                  ? " · four documentary references recorded (not independently verified)"
                  : ""}
                {record.prior_review_id
                  ? ` · follows ${record.prior_review_id}`
                  : ""}
                {" — "}
                {record.review_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Build 141 — Independent gateway HOLD freshness, aged exception
            recurrence &amp; QL-245 receipt queue
          </h2>
          <p>
            ⓘ The revised QL-245 six-app handoff requests actual nonproduction
            server-only, signed GET evidence, seven real denial traces, a
            separately pinned public signer, a genuine 40-character source SHA
            and a GREEN CI run. These fields are a private documentary follow-up
            queue <strong>only</strong>: entered references remain UNVERIFIED
            until an independent reviewer examines the originals. iCamp remains
            DISCONNECTED / HOLD. No keys, bearer tokens, customer data, real
            calls, payments, messages or device commands belong in this form.
          </p>
          <p>
            QL-245 permits only read_health and read_capabilities through the
            two authenticated nonproduction GET routes. The public offline
            Ed25519 packet, distinct trust-channel pins, real negative tests and
            source/gateway audit receipts are not produced by this owner screen.
            Missing evidence stays NOT PROVISIONED or UNVERIFIED, and owner
            pilot approval remains NOT GIVEN.
          </p>
          <h3>Independent owner HOLD verification queue</h3>
          {gatewayHoldReceiptQueue.slice(0, 20).map((item) => (
            <form key={item.id} action={recordGatewayHoldReceiptReviewAction}>
              {pair}
              <input
                type="hidden"
                name="gatewayReviewId"
                value={item.gatewayReviewId}
              />
              <input
                type="hidden"
                name="priorReviewId"
                value={item.priorReviewId}
              />
              <input type="hidden" name="reviewKind" value={item.reviewKind} />
              <p>
                {item.reviewKind} · {item.status} · source gate{" "}
                {item.gatewayReviewId}
              </p>
              <label>
                Independent documentary outcome{" "}
                <select name="outcomeKind" required>
                  {gatewayHoldReceiptOptions[item.reviewKind].map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {item.reviewKind === "owner_safe_receipt_verification_queue" && (
                <>
                  <label>
                    QL-245 receipt to check{" "}
                    <select name="receiptKind" required>
                      <option value="">
                        Select a single source or denial evidence type
                      </option>
                      {gatewayHoldReceiptKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    ⓘ For an unverified receipt, use an actual nonsecret np-
                    identifier. Leave the field empty if NOT PROVISIONED or
                    missing. For a source CI revision, supply both the exact SHA
                    and matching Actions URL. Never paste private signing
                    material or a packet.
                  </p>
                  <label>
                    Nonsecret np- source/registry/denial receipt ID (if actually
                    received){" "}
                    <input
                      name="receiptReference"
                      maxLength={160}
                      pattern="np-[A-Za-z0-9._:-]{5,157}"
                    />
                  </label>
                  <label>
                    iCamp exact 40-character source SHA (source CI item only){" "}
                    <input
                      name="sourceRevision"
                      maxLength={40}
                      pattern="[0-9a-f]{40}"
                    />
                  </label>
                  <label>
                    Actual GREEN GitHub Actions run URL (source CI item only){" "}
                    <input name="ciRunUrl" type="url" maxLength={130} />
                  </label>
                </>
              )}
              <label>
                Next independent UTC follow-up date (within 90 days){" "}
                <input type="date" name="nextDueAt" required />
              </label>
              <label>
                Nonsecret evidence index{" "}
                <input
                  name="evidenceReference"
                  minLength={8}
                  maxLength={400}
                  required
                />
              </label>
              <label>
                Freshness, aging or receipt verification findings{" "}
                <textarea
                  name="reviewNote"
                  minLength={12}
                  maxLength={800}
                  required
                />
              </label>
              <button type="submit">
                Record Build 141 independent HOLD follow-up
              </button>
            </form>
          ))}
          <h3>Immutable Build 141 UNVERIFIED/DISCONNECTED audit history</h3>
          <ul>
            {report.gatewayHoldReceiptReviews.map((record) => (
              <li key={record.id}>
                {record.review_kind} · {record.outcome_kind} ·{" "}
                {record.review_status}
                {` · gate ${record.gate_state} · connection ${record.connection_state} · proof ${record.receipt_proof_state} · owner pilot NOT GIVEN · dispatch disabled · Build 140 gateway ${record.gateway_review_id} · source age ${record.observed_gateway_review_age_days} days · proof age ${record.observed_proof_age_days} days · prior overdue ${record.observed_prior_overdue_days} days · open Build 140 exceptions ${record.observed_open_140_exceptions} · overdue Build 140 leaves ${record.observed_overdue_140_leaves} · newer same-root gates ${record.observed_newer_gateway_reviews}`}
                {record.receipt_kind
                  ? ` · queued proof ${record.receipt_kind}`
                  : ""}
                {record.receipt_reference
                  ? ` · nonsecret reference ${record.receipt_reference}`
                  : ""}
                {record.source_revision
                  ? ` · claimed source SHA ${record.source_revision}`
                  : ""}
                {record.prior_review_id
                  ? ` · follows ${record.prior_review_id}`
                  : ""}
                {" — "}
                {record.review_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Immutable decision history</h2>
          <ul>
            {report.decisions.map((d) => (
              <li key={d.id}>
                {d.decision_kind} · {d.recurrence_review_id} — {d.decision_note}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
