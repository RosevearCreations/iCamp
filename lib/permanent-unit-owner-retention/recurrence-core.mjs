const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function id(raw, name) {
  const v = String(raw ?? "").trim();
  if (!uuid.test(v)) throw new Error(`${name} needs a valid identifier.`);
  return v;
}
function note(raw, name, min, max) {
  const v = String(raw ?? "").trim();
  if (
    v.length < min ||
    v.length > max ||
    /@|\d{7,}|\b(?:sin|ssn|bank.account|credit.card)\b/i.test(v)
  )
    throw new Error(
      `${name} must be ${min}–${max} characters without identifiers.`,
    );
  return v;
}
function pair(raw) {
  const sourceCampgroundId = id(raw.sourceCampgroundId, "source"),
    targetCampgroundId = id(raw.targetCampgroundId, "target");
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error("Two different campgrounds are required.");
  return { sourceCampgroundId, targetCampgroundId };
}
export function normalizeRecurrenceReview(raw) {
  return {
    id: id(raw.id, "review"),
    acceptanceId: id(raw.acceptanceId, "acceptance"),
    ...pair(raw),
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    reviewNote: note(raw.reviewNote, "Review note", 12, 800),
  };
}
export function normalizeRecurrenceDecision(raw, now = new Date()) {
  const decisionKind = String(raw.decisionKind ?? "").trim();
  if (
    ![
      "continue_monitoring",
      "request_evidence",
      "manual_escalation",
      "independent_no_action",
    ].includes(decisionKind)
  )
    throw new Error("Unknown recurrence decision.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (decisionKind === "independent_no_action") {
    if (next) throw new Error("No-action cannot schedule a pending follow-up.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC review date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Review must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "decision"),
    recurrenceReviewId: id(raw.recurrenceReviewId, "review"),
    ...pair(raw),
    decisionKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    decisionNote: note(raw.decisionNote, "Decision note", 12, 800),
  };
}
export function classifyRecurrenceFollowUp(decision, now = new Date()) {
  if (decision.decision_kind === "independent_no_action") return "closed";
  if (decision.reassessment_id) return "reassessed";
  if (!decision.next_due_at) return "missing_due_date";
  const due = new Date(decision.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_due_date";
  const days = Math.floor((now.getTime() - due.getTime()) / 86400000);
  return days >= 0 ? (days >= 30 ? "overdue_30_plus" : "overdue") : "pending";
}
export function normalizeIndependentReassessment(raw) {
  const assessmentKind = String(raw.assessmentKind ?? "").trim();
  if (
    ![
      "continue_hold",
      "request_new_evidence",
      "manual_escalation",
      "confirm_resolution",
    ].includes(assessmentKind)
  )
    throw new Error("Unknown independent reassessment outcome.");
  return {
    id: id(raw.id, "reassessment"),
    recurrenceDecisionId: id(raw.recurrenceDecisionId, "decision"),
    ...pair(raw),
    assessmentKind,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    assessmentNote: note(raw.assessmentNote, "Assessment note", 12, 800),
  };
}
export function normalizeEvidenceGapAction(raw, now = new Date()) {
  const actionKind = String(raw.actionKind ?? "").trim();
  if (
    ![
      "evidence_requested",
      "evidence_submitted",
      "manual_escalation",
      "owner_reconciled",
    ].includes(actionKind)
  )
    throw new Error("Unknown evidence gap action.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (["evidence_requested", "manual_escalation"].includes(actionKind)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Follow-up must be due within 90 days.");
    nextDueAt = due.toISOString();
  } else if (next)
    throw new Error(
      "Completed evidence actions cannot schedule an open follow-up.",
    );
  return {
    id: id(raw.id, "action"),
    reassessmentId: id(raw.reassessmentId, "reassessment"),
    ...pair(raw),
    actionKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    actionNote: note(raw.actionNote, "Action note", 12, 800),
  };
}
export function classifyEvidenceGap(
  reassessment,
  latestAction,
  now = new Date(),
) {
  if (!latestAction)
    return Math.floor(
      (now.getTime() - new Date(reassessment.assessed_at).getTime()) / 86400000,
    ) >= 30
      ? "unreconciled_30_plus"
      : "unreconciled";
  if (
    ["evidence_submitted", "owner_reconciled"].includes(
      latestAction.action_kind,
    )
  )
    return latestAction.action_kind === "owner_reconciled"
      ? "owner_reconciled"
      : "evidence_submitted";
  if (!latestAction.next_due_at) return "due_date_missing";
  const remaining =
    new Date(latestAction.next_due_at).getTime() - now.getTime();
  return remaining <= -30 * 86400000
    ? "overdue_30_plus"
    : remaining <= 0
      ? "overdue"
      : "awaiting_followup";
}
export function normalizeReconciliationExceptionReview(raw) {
  return {
    id: id(raw.id, "exception review"),
    ownerActionId: id(raw.ownerActionId, "reconciled owner action"),
    ...pair(raw),
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    reviewNote: note(raw.reviewNote, "Review note", 12, 800),
  };
}
export function normalizeIndependentClosureRecheck(raw) {
  const recheckKind = String(raw.recheckKind ?? "").trim();
  if (
    ![
      "continue_exception",
      "request_new_evidence",
      "manual_escalation",
      "independent_audit_closed",
    ].includes(recheckKind)
  )
    throw new Error("Unknown closure recheck decision.");
  return {
    id: id(raw.id, "closure recheck"),
    exceptionReviewId: id(raw.exceptionReviewId, "exception review"),
    ...pair(raw),
    recheckKind,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    recheckNote: note(raw.recheckNote, "Recheck note", 12, 800),
  };
}
export function normalizeClosureOwnerDecision(raw, now = new Date()) {
  const decisionKind = String(raw.decisionKind ?? "").trim();
  if (
    ![
      "keep_exception_open",
      "request_evidence",
      "manual_escalation",
      "acknowledge_audit_closure",
    ].includes(decisionKind)
  )
    throw new Error("Unknown owner closure decision.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (decisionKind === "acknowledge_audit_closure") {
    if (next)
      throw new Error(
        "Closure acknowledgment cannot schedule a pending follow-up.",
      );
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Owner follow-up must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "owner decision"),
    closureRecheckId: id(raw.closureRecheckId, "independent closure recheck"),
    ...pair(raw),
    decisionKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    decisionNote: note(raw.decisionNote, "Decision note", 12, 800),
  };
}
export function classifyClosureOwnerDecision(
  recheck,
  decision,
  now = new Date(),
) {
  if (!decision)
    return now.getTime() - new Date(recheck.rechecked_at).getTime() >=
      30 * 86400000
      ? "awaiting_owner_30_plus"
      : "awaiting_owner";
  if (decision.decision_kind === "acknowledge_audit_closure")
    return "audit_acknowledged";
  if (!decision.next_due_at) return "missing_due_date";
  const elapsed = now.getTime() - new Date(decision.next_due_at).getTime();
  return elapsed >= 30 * 86400000
    ? "overdue_30_plus"
    : elapsed >= 0
      ? "overdue"
      : "owner_followup_pending";
}
export function normalizeIndependentClosureFollowupReview(
  raw,
  now = new Date(),
) {
  const reviewKind = String(raw.reviewKind ?? "").trim();
  if (
    ![
      "continue_exception",
      "request_new_evidence",
      "manual_escalation",
      "confirm_audit_acknowledged",
    ].includes(reviewKind)
  )
    throw new Error("Unknown independent owner follow-up outcome.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (reviewKind === "confirm_audit_acknowledged") {
    if (next)
      throw new Error("Independent audit confirmation has no follow-up date.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC independent follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Independent follow-up must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "independent follow-up review"),
    ownerDecisionId: id(raw.ownerDecisionId, "owner closure decision"),
    ...pair(raw),
    reviewKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    reviewNote: note(raw.reviewNote, "Independent rationale", 12, 800),
  };
}
export function classifyIndependentClosureFollowup(
  decision,
  review,
  now = new Date(),
) {
  if (review) {
    if (review.review_kind === "manual_escalation")
      return "independently_escalated";
    if (review.review_kind === "confirm_audit_acknowledged")
      return "audit_independently_confirmed";
    return "independently_reviewed";
  }
  if (decision.decision_kind === "acknowledge_audit_closure")
    return "awaiting_independent_confirmation";
  if (!decision.next_due_at) return "missing_due_date";
  const due = new Date(decision.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "overdue_30_plus_escalate"
    : elapsed >= 0
      ? "overdue_independent_review"
      : "independent_review_pending";
}
export function normalizeOwnerFollowupHandoffDecision(raw, now = new Date()) {
  const actionKind = String(raw.actionKind ?? "").trim();
  if (
    ![
      "escalation_handoff_accepted",
      "evidence_requested",
      "evidence_reconciled",
      "monitoring_continues",
      "audit_confirmation_acknowledged",
    ].includes(actionKind)
  )
    throw new Error("Unknown owner independent follow-up action.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (
    ["evidence_reconciled", "audit_confirmation_acknowledged"].includes(
      actionKind,
    )
  ) {
    if (next)
      throw new Error(
        "Completed owner evidence decisions cannot schedule a follow-up.",
      );
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC handoff follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Owner handoff must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "handoff decision"),
    independentReviewId: id(raw.independentReviewId, "independent follow-up"),
    ...pair(raw),
    actionKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    actionNote: note(raw.actionNote, "Owner rationale", 12, 800),
  };
}
export function classifyIndependentOutcomeAging(
  review,
  handoff,
  now = new Date(),
) {
  if (handoff) {
    if (handoff.action_kind === "escalation_handoff_accepted")
      return "escalation_handoff_recorded";
    if (handoff.action_kind === "evidence_reconciled")
      return "owner_evidence_reconciled";
    if (handoff.action_kind === "audit_confirmation_acknowledged")
      return "owner_audit_acknowledged";
    return "owner_action_recorded";
  }
  if (review.review_kind === "confirm_audit_acknowledged")
    return "awaiting_owner_audit_acknowledgment";
  if (!review.next_due_at) return "missing_followup_due_date";
  const due = new Date(review.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_followup_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "owner_handoff_overdue_30_plus"
    : elapsed >= 0
      ? "owner_handoff_overdue"
      : review.review_kind === "manual_escalation"
        ? "escalation_handoff_pending"
        : "owner_evidence_decision_pending";
}
export function normalizeHandoffIndependentClosureAudit(raw, now = new Date()) {
  const auditKind = String(raw.auditKind ?? "").trim();
  if (
    ![
      "continue_exception",
      "request_evidence_reassessment",
      "manual_escalation",
      "independent_audit_closed",
    ].includes(auditKind)
  )
    throw new Error("Unknown independent handoff audit finding.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (auditKind === "independent_audit_closed") {
    if (next)
      throw new Error(
        "Independent audit closure cannot schedule another follow-up.",
      );
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC independent evidence review date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Independent reassessment must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "independent closure audit"),
    handoffDecisionId: id(raw.handoffDecisionId, "owner handoff"),
    ...pair(raw),
    auditKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    auditNote: note(raw.auditNote, "Independent finding", 12, 800),
  };
}
export function classifyHandoffIndependentClosureStatus(
  handoff,
  audit,
  now = new Date(),
) {
  if (audit) {
    if (audit.audit_kind === "independent_audit_closed")
      return "independent_audit_closed";
    if (audit.audit_kind === "manual_escalation")
      return "independently_escalated";
    if (audit.audit_kind === "request_evidence_reassessment")
      return "evidence_reassessment_requested";
    return "exception_reviewed_open";
  }
  if (
    ["evidence_reconciled", "audit_confirmation_acknowledged"].includes(
      handoff.action_kind,
    )
  )
    return "awaiting_independent_evidence_audit";
  if (!handoff.next_due_at) return "missing_handoff_due_date";
  const due = new Date(handoff.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_handoff_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "handoff_overdue_30_plus"
    : elapsed >= 0
      ? "handoff_overdue"
      : "handoff_independent_audit_pending";
}
export function normalizeClosureAuditOwnerSignoff(raw, now = new Date()) {
  const signoffKind = String(raw.signoffKind ?? "").trim();
  if (
    ![
      "owner_exception_signed_off",
      "request_evidence_refresh",
      "accept_manual_escalation",
      "acknowledge_independent_closure",
    ].includes(signoffKind)
  )
    throw new Error("Unknown closure audit owner sign-off.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (signoffKind === "acknowledge_independent_closure") {
    if (next)
      throw new Error(
        "Independent closure acknowledgment has no open due date.",
      );
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC owner reassessment due date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Owner reassessment must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "owner sign-off"),
    independentAuditId: id(raw.independentAuditId, "independent closure audit"),
    ...pair(raw),
    signoffKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    signoffNote: note(raw.signoffNote, "Owner sign-off rationale", 12, 800),
  };
}
export function classifyClosureAuditOwnerSignoff(
  audit,
  signoff,
  now = new Date(),
) {
  if (signoff) {
    if (signoff.signoff_kind === "acknowledge_independent_closure")
      return "independent_closure_acknowledged";
    if (signoff.signoff_kind === "accept_manual_escalation")
      return "owner_escalation_accepted";
    if (signoff.signoff_kind === "request_evidence_refresh")
      return "owner_evidence_refresh_requested";
    return "owner_exception_signed_off_open";
  }
  if (audit.audit_kind === "independent_audit_closed")
    return "awaiting_owner_closure_acknowledgment";
  if (!audit.next_due_at) return "missing_reassessment_due_date";
  const due = new Date(audit.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_reassessment_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "independent_reassessment_overdue_30_plus"
    : elapsed >= 0
      ? "independent_reassessment_overdue"
      : audit.audit_kind === "manual_escalation"
        ? "escalation_owner_signoff_pending"
        : "independent_reassessment_pending";
}
export function normalizeOwnerSignoffIndependentCloseout(
  raw,
  now = new Date(),
) {
  const reviewKind = String(raw.reviewKind ?? "").trim();
  if (
    ![
      "continue_exception",
      "request_escalation_evidence_refresh",
      "manual_escalation",
      "independent_exception_closed",
    ].includes(reviewKind)
  )
    throw new Error("Unknown independent owner sign-off review outcome.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (reviewKind === "independent_exception_closed") {
    if (next)
      throw new Error(
        "Independent exception closeout cannot schedule an open review.",
      );
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC independent follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Independent follow-up must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "independent closeout review"),
    ownerSignoffId: id(raw.ownerSignoffId, "owner exception sign-off"),
    ...pair(raw),
    reviewKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    reviewNote: note(raw.reviewNote, "Independent review rationale", 12, 800),
  };
}
export function classifyOwnerSignoffFollowup(
  signoff,
  review,
  now = new Date(),
) {
  if (review) {
    if (review.review_kind === "independent_exception_closed")
      return "independent_exception_closed";
    if (review.review_kind === "manual_escalation")
      return "independently_escalated_again";
    if (review.review_kind === "request_escalation_evidence_refresh")
      return "escalation_evidence_refresh_requested";
    return "exception_followup_continues";
  }
  if (signoff.signoff_kind === "acknowledge_independent_closure")
    return "awaiting_independent_closeout";
  if (!signoff.next_due_at) return "missing_owner_followup_due_date";
  const due = new Date(signoff.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_owner_followup_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "owner_signoff_followup_overdue_30_plus"
    : elapsed >= 0
      ? "owner_signoff_followup_overdue"
      : signoff.signoff_kind === "accept_manual_escalation"
        ? "escalation_evidence_followup_pending"
        : "owner_signoff_followup_pending";
}
export function normalizeIndependentCloseoutOwnerOutcome(
  raw,
  now = new Date(),
) {
  const outcomeKind = String(raw.outcomeKind ?? "").trim();
  if (
    ![
      "continue_owner_followup",
      "submit_refreshed_evidence",
      "renew_escalation_exception",
      "acknowledge_independent_closeout",
    ].includes(outcomeKind)
  )
    throw new Error("Unknown owner evidence outcome audit decision.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (outcomeKind === "acknowledge_independent_closeout") {
    if (next)
      throw new Error(
        "Independent closeout acknowledgment has no open follow-up date.",
      );
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC owner evidence follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Owner evidence follow-up must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "owner outcome audit"),
    closeoutReviewId: id(raw.closeoutReviewId, "independent closeout review"),
    ...pair(raw),
    outcomeKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    outcomeNote: note(
      raw.outcomeNote,
      "Owner evidence outcome rationale",
      12,
      800,
    ),
  };
}
export function classifyIndependentCloseoutOutcomeAging(
  review,
  outcome,
  now = new Date(),
) {
  if (outcome) {
    if (outcome.outcome_kind === "acknowledge_independent_closeout")
      return "owner_closeout_acknowledged";
    if (outcome.outcome_kind === "renew_escalation_exception")
      return "owner_escalation_exception_renewed";
    if (outcome.outcome_kind === "submit_refreshed_evidence")
      return "refreshed_owner_evidence_submitted";
    return "owner_followup_continues";
  }
  if (review.review_kind === "independent_exception_closed")
    return "awaiting_owner_evidence_closeout_acknowledgment";
  if (!review.next_due_at) return "missing_independent_due_date";
  const due = new Date(review.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_independent_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "independent_closeout_followup_overdue_30_plus"
    : elapsed >= 0
      ? "independent_closeout_followup_overdue"
      : review.review_kind === "manual_escalation"
        ? "owner_escalation_renewal_pending"
        : "owner_evidence_outcome_pending";
}

export function normalizeOwnerEvidenceIndependentDisposition(
  raw,
  now = new Date(),
) {
  const dispositionKind = String(raw.dispositionKind ?? "").trim();
  if (
    ![
      "continue_independent_monitoring",
      "request_owner_evidence_renewal",
      "escalate_renewal_exception",
      "verify_closure_continuity",
    ].includes(dispositionKind)
  )
    throw new Error("Unknown independent owner evidence disposition.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (dispositionKind === "verify_closure_continuity") {
    if (next)
      throw new Error("Closure continuity cannot schedule an open follow-up.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC independent evidence renewal date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error(
        "Independent evidence renewal follow-up must be due within 90 days.",
      );
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "independent evidence disposition"),
    ownerOutcomeId: id(raw.ownerOutcomeId, "owner evidence outcome"),
    ...pair(raw),
    dispositionKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    dispositionNote: note(
      raw.dispositionNote,
      "Independent disposition rationale",
      12,
      800,
    ),
  };
}

export function classifyOwnerEvidenceRenewalDisposition(
  outcome,
  disposition,
  now = new Date(),
) {
  if (disposition) {
    if (disposition.disposition_kind === "verify_closure_continuity")
      return "independent_closure_continuity_verified";
    if (disposition.disposition_kind === "escalate_renewal_exception")
      return "independent_escalation_disposition_recorded";
    if (disposition.disposition_kind === "request_owner_evidence_renewal")
      return "owner_evidence_renewal_requested";
    return "independent_evidence_watch_continues";
  }
  if (outcome.outcome_kind === "acknowledge_independent_closeout")
    return "independent_closure_continuity_review_pending";
  if (!outcome.next_due_at) return "missing_owner_evidence_due_date";
  const due = new Date(outcome.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_owner_evidence_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "owner_evidence_renewal_overdue_30_plus"
    : elapsed >= 0
      ? "owner_evidence_renewal_overdue"
      : outcome.outcome_kind === "renew_escalation_exception"
        ? "independent_escalation_disposition_pending"
        : outcome.outcome_kind === "submit_refreshed_evidence"
          ? "independent_evidence_refresh_review_pending"
          : "independent_owner_followup_review_pending";
}

export function normalizeIndependentDispositionRecheck(raw, now = new Date()) {
  const recheckKind = String(raw.recheckKind ?? "").trim();
  if (
    ![
      "continue_followup_watch",
      "request_owner_renewal_replay",
      "renew_escalation_recheck",
      "confirm_closure_continuity_recheck",
    ].includes(recheckKind)
  )
    throw new Error("Unknown independent escalation disposition recheck.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (recheckKind === "confirm_closure_continuity_recheck") {
    if (next)
      throw new Error("Closure continuity recheck has no open follow-up date.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC independent recheck follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Independent recheck must follow up within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "independent disposition recheck"),
    independentDispositionId: id(
      raw.independentDispositionId,
      "independent disposition",
    ),
    replayOwnerOutcomeId: id(
      raw.replayOwnerOutcomeId,
      "replayed owner evidence outcome",
    ),
    ...pair(raw),
    recheckKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence replay reference",
      8,
      400,
    ),
    recheckNote: note(raw.recheckNote, "Recheck rationale", 12, 800),
  };
}

export function classifyIndependentDispositionRecheckAging(
  disposition,
  recheck,
  now = new Date(),
) {
  if (recheck) {
    if (recheck.recheck_kind === "confirm_closure_continuity_recheck")
      return "independent_closure_continuity_reconfirmed";
    if (recheck.recheck_kind === "renew_escalation_recheck")
      return "independent_escalation_recheck_renewed";
    if (recheck.recheck_kind === "request_owner_renewal_replay")
      return "owner_evidence_replay_requested";
    return "independent_followup_watch_rechecked";
  }
  if (disposition.disposition_kind === "verify_closure_continuity")
    return "independent_closure_continuity_recheck_pending";
  if (!disposition.next_due_at)
    return "missing_independent_disposition_due_date";
  const due = new Date(disposition.next_due_at);
  if (!Number.isFinite(due.getTime()))
    return "invalid_independent_disposition_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "independent_disposition_recheck_overdue_30_plus"
    : elapsed >= 0
      ? "independent_disposition_recheck_overdue"
      : disposition.disposition_kind === "escalate_renewal_exception"
        ? "independent_escalation_recheck_pending"
        : disposition.disposition_kind === "request_owner_evidence_renewal"
          ? "owner_renewal_replay_pending"
          : "independent_followup_recheck_pending";
}

export function normalizeIndependentRecheckOwnerDecision(
  raw,
  now = new Date(),
) {
  const decisionKind = String(raw.decisionKind ?? "").trim();
  if (
    ![
      "continue_replay_followup",
      "submit_replay_gap_evidence",
      "renew_escalation_exception",
      "acknowledge_closure_proof",
    ].includes(decisionKind)
  )
    throw new Error("Unknown owner replay-gap exception decision.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (decisionKind === "acknowledge_closure_proof") {
    if (next)
      throw new Error("Closure proof acknowledgment has no follow-up date.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC owner replay-gap follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Owner replay-gap follow-up must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "owner replay-gap decision"),
    independentRecheckId: id(
      raw.independentRecheckId,
      "independent evidence recheck",
    ),
    ...pair(raw),
    decisionKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Gap evidence reference",
      8,
      400,
    ),
    decisionNote: note(raw.decisionNote, "Owner decision rationale", 12, 800),
  };
}

export function classifyOwnerReplayGapAging(
  recheck,
  decision,
  now = new Date(),
) {
  if (decision) {
    if (decision.decision_kind === "acknowledge_closure_proof")
      return "closure_proof_continuity_acknowledged";
    if (decision.decision_kind === "renew_escalation_exception")
      return "owner_recheck_escalation_renewed";
    if (decision.decision_kind === "submit_replay_gap_evidence")
      return "replay_gap_evidence_submitted";
    return "owner_replay_followup_continues";
  }
  if (recheck.recheck_kind === "confirm_closure_continuity_recheck")
    return "owner_closure_proof_acknowledgment_pending";
  if (!recheck.next_due_at) return "missing_replay_gap_due_date";
  const due = new Date(recheck.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_replay_gap_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "owner_replay_gap_overdue_30_plus"
    : elapsed >= 0
      ? "owner_replay_gap_overdue"
      : recheck.recheck_kind === "renew_escalation_recheck"
        ? "owner_escalation_recheck_decision_pending"
        : recheck.recheck_kind === "request_owner_renewal_replay"
          ? "owner_replay_gap_evidence_pending"
          : "owner_replay_followup_pending";
}

export function normalizeIndependentProofContinuityReview(
  raw,
  now = new Date(),
) {
  const reviewKind = String(raw.reviewKind ?? "").trim();
  if (
    ![
      "continue_exception_watch",
      "request_disposition_evidence",
      "renew_independent_escalation",
      "confirm_proof_continuity",
    ].includes(reviewKind)
  )
    throw new Error("Unknown independent closure proof review.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (reviewKind === "confirm_proof_continuity") {
    if (next)
      throw new Error(
        "Independent proof confirmation cannot set a follow-up date.",
      );
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC independent proof follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error(
        "Independent proof follow-up must be due within 90 days.",
      );
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "independent proof review"),
    ownerDecisionId: id(raw.ownerDecisionId, "owner disposition"),
    replayOwnerDecisionId: id(
      raw.replayOwnerDecisionId,
      "replayed owner disposition",
    ),
    ...pair(raw),
    reviewKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Proof evidence reference",
      8,
      400,
    ),
    reviewNote: note(
      raw.reviewNote,
      "Independent continuity rationale",
      12,
      800,
    ),
  };
}

export function classifyOwnerProofContinuityAging(
  ownerDecision,
  review,
  now = new Date(),
) {
  if (review) {
    if (review.review_kind === "confirm_proof_continuity")
      return "independent_continuity_confirmed";
    if (review.review_kind === "renew_independent_escalation")
      return "independent_exception_renewed";
    if (review.review_kind === "request_disposition_evidence")
      return "independent_disposition_replay_requested";
    return "independent_watch_continues";
  }
  if (ownerDecision.decision_kind === "acknowledge_closure_proof")
    return "independent_continuity_confirmation_pending";
  if (!ownerDecision.next_due_at)
    return "missing_owner_proof_followup_due_date";
  const due = new Date(ownerDecision.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_owner_proof_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "owner_proof_exception_overdue_30_plus"
    : elapsed >= 0
      ? "owner_proof_exception_overdue"
      : ownerDecision.decision_kind === "renew_escalation_exception"
        ? "independent_escalation_renewal_pending"
        : "independent_evidence_disposition_pending";
}

const closureRecurrenceOutcomes = {
  independent_recurrence_check: [
    "continuity_stable",
    "recurrence_gap",
    "recurrence_escalated",
  ],
  owner_exception_reopen: ["reopen_evidence", "reopen_escalation"],
  independent_followup_verify: [
    "verify_followup_evidence",
    "request_more_followup_evidence",
    "renew_followup_escalation",
  ],
};
export function normalizeClosureRecurrenceEvent(raw, now = new Date()) {
  const eventKind = String(raw.eventKind ?? "").trim(),
    outcomeKind = String(raw.outcomeKind ?? "").trim();
  if (!closureRecurrenceOutcomes[eventKind]?.includes(outcomeKind))
    throw new Error("Invalid closure recurrence stage or outcome.");
  const prior = String(raw.priorEventId ?? "").trim(),
    ownerEvidence = String(raw.ownerEvidenceDecisionId ?? "").trim();
  if (eventKind === "independent_recurrence_check" && prior)
    throw new Error("Initial independent check cannot cite a prior event.");
  if (eventKind !== "independent_recurrence_check" && !prior)
    throw new Error(
      "Owner reopening and independent follow-up need their prior event.",
    );
  if (outcomeKind === "verify_followup_evidence" && !ownerEvidence)
    throw new Error(
      "Verified follow-up needs a linked owner evidence disposition.",
    );
  if (outcomeKind !== "verify_followup_evidence" && ownerEvidence)
    throw new Error(
      "Open stages cannot cite a completed owner evidence disposition.",
    );
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (outcomeKind === "verify_followup_evidence") {
    if (next)
      throw new Error(
        "Verified audit follow-up cannot schedule an open due date.",
      );
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC recurrence follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Recurrence audit follow-up must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "recurrence event"),
    proofReviewId: id(raw.proofReviewId, "independent proof review"),
    priorEventId: prior ? id(prior, "prior recurrence event") : null,
    ownerEvidenceDecisionId: ownerEvidence
      ? id(ownerEvidence, "replayed owner evidence")
      : null,
    ...pair(raw),
    eventKind,
    outcomeKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Recurrence evidence reference",
      8,
      400,
    ),
    eventNote: note(raw.eventNote, "Recurrence audit rationale", 12, 800),
  };
}
export function classifyClosureRecurrenceStatus(
  event,
  nextEvent,
  now = new Date(),
) {
  if (event.outcome_kind === "verify_followup_evidence")
    return "verified_source_linked_followup";
  if (nextEvent)
    return nextEvent.outcome_kind === "verify_followup_evidence"
      ? "verified_source_linked_followup"
      : "next_recurrence_stage_recorded";
  if (event.outcome_kind === "continuity_stable")
    return "continuity_monitoring_stable";
  if (!event.next_due_at) return "missing_recurrence_due_date";
  const due = new Date(event.next_due_at);
  if (!Number.isFinite(due.getTime())) return "invalid_recurrence_due_date";
  const elapsed = now.getTime() - due.getTime();
  return elapsed >= 30 * 86400000
    ? "recurrence_followup_overdue_30_plus"
    : elapsed >= 0
      ? "recurrence_followup_overdue"
      : event.event_kind === "independent_recurrence_check"
        ? "owner_exception_reopening_pending"
        : "independent_audit_followup_pending";
}

const exceptionAgingOutcomes = {
  independent_followup_reassessment: [
    "evidence_gap_pending",
    "evidence_aging_escalated",
    "followup_evidence_reassessed",
  ],
  continuity_recurrence_oversight: [
    "continuity_watch_open",
    "recurrence_exception_detected",
    "continuity_escalation_renewed",
    "continuity_recheck_verified",
  ],
};
export function normalizeReopenedExceptionAgingReview(raw, now = new Date()) {
  const reviewKind = String(raw.reviewKind ?? "").trim();
  const outcomeKind = String(raw.outcomeKind ?? "").trim();
  if (!exceptionAgingOutcomes[reviewKind]?.includes(outcomeKind))
    throw new Error(
      "Invalid reopened exception reassessment or oversight outcome.",
    );
  const prior = String(raw.priorReviewId ?? "").trim();
  const verified = String(raw.verifiedFollowupEventId ?? "").trim();
  if (reviewKind === "independent_followup_reassessment" && prior)
    throw new Error("Initial reassessment cannot cite a previous review.");
  if (reviewKind === "continuity_recurrence_oversight" && !prior)
    throw new Error("Continuity oversight needs an independent prior review.");
  const requiresProof = [
    "followup_evidence_reassessed",
    "continuity_recheck_verified",
  ].includes(outcomeKind);
  if (requiresProof !== Boolean(verified))
    throw new Error(
      "Verified outcomes require a linked verified follow-up receipt; open findings cannot cite one.",
    );
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (outcomeKind === "continuity_recheck_verified") {
    if (next)
      throw new Error("Verified continuity cannot retain an open due date.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC reopened exception review date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Reopened exception review must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "exception review"),
    reopenEventId: id(raw.reopenEventId, "reopened exception"),
    priorReviewId: prior ? id(prior, "prior oversight review") : null,
    verifiedFollowupEventId: verified
      ? id(verified, "verified source-linked follow-up")
      : null,
    ...pair(raw),
    reviewKind,
    outcomeKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Review evidence reference",
      8,
      400,
    ),
    reviewNote: note(raw.reviewNote, "Reassessment rationale", 12, 800),
  };
}
export function classifyReopenedExceptionAgingStatus(
  review,
  next,
  now = new Date(),
) {
  if (review.outcome_kind === "continuity_recheck_verified")
    return "independent_continuity_recheck_verified";
  if (next) return "subsequent_continuity_review_recorded";
  if (!review.next_due_at) return "reopened_exception_due_date_missing";
  const due = new Date(review.next_due_at);
  if (!Number.isFinite(due.getTime()))
    return "reopened_exception_due_date_invalid";
  const age = now.getTime() - due.getTime();
  if (age >= 30 * 86400000) return "reopened_exception_overdue_30_plus";
  if (age >= 0) return "reopened_exception_overdue";
  return review.review_kind === "independent_followup_reassessment"
    ? "continuity_oversight_pending"
    : "continuity_recurrence_watch_pending";
}
const continuityResolutionOutcomes = {
  independent_continuity_recheck: [
    "continuity_watch_renewed",
    "recurrence_gap_escalated",
    "continuity_recheck_confirmed",
  ],
  overdue_exception_resolution: [
    "resolution_evidence_pending",
    "overdue_exception_escalated",
    "resolution_evidence_verified",
  ],
  verified_closure_followup: [
    "closure_followup_pending",
    "closure_followup_verified",
  ],
};
export function normalizeContinuityResolutionFollowup(raw, now = new Date()) {
  const followupKind = String(raw.followupKind ?? "").trim();
  const outcomeKind = String(raw.outcomeKind ?? "").trim();
  if (!continuityResolutionOutcomes[followupKind]?.includes(outcomeKind))
    throw new Error(
      "Invalid continuity recheck, exception resolution or closure follow-up.",
    );
  const prior = String(raw.priorFollowupId ?? "").trim();
  const verified = String(raw.verifiedFollowupEventId ?? "").trim();
  if (!prior && followupKind !== "independent_continuity_recheck")
    throw new Error(
      "Resolution and closure require a previous independent recheck.",
    );
  const requiresProof = [
    "continuity_recheck_confirmed",
    "resolution_evidence_verified",
    "closure_followup_verified",
  ].includes(outcomeKind);
  if (requiresProof !== Boolean(verified))
    throw new Error(
      "Verified follow-up outcomes require a source-linked receipt; open results cannot cite one.",
    );
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (outcomeKind === "closure_followup_verified") {
    if (next) throw new Error("Verified closure cannot have an open due date.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter the next UTC review date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Open independent follow-up must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "continuity follow-up"),
    agingReviewId: id(raw.agingReviewId, "Build 131 aging review"),
    priorFollowupId: prior ? id(prior, "prior follow-up") : null,
    verifiedFollowupEventId: verified
      ? id(verified, "verified follow-up")
      : null,
    ...pair(raw),
    followupKind,
    outcomeKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence source reference",
      8,
      400,
    ),
    followupNote: note(
      raw.followupNote,
      "Independent follow-up rationale",
      12,
      800,
    ),
  };
}
export function classifyContinuityResolutionStatus(
  record,
  next,
  now = new Date(),
) {
  if (record.outcome_kind === "closure_followup_verified")
    return "independent_closure_followup_verified";
  if (next) return "subsequent_independent_followup_recorded";
  const due = new Date(record.next_due_at ?? "");
  if (!Number.isFinite(due.getTime())) return "resolution_due_date_missing";
  const age = now.getTime() - due.getTime();
  if (age >= 30 * 86400000) return "resolution_overdue_30_plus";
  if (age >= 0) return "resolution_overdue";
  return record.followup_kind === "verified_closure_followup"
    ? "verified_closure_followup_pending"
    : "independent_resolution_recheck_pending";
}
const verifiedClosureMonitorOutcomes = {
  verified_closure_recurrence_monitor: [
    "closure_watch_stable",
    "recurrence_evidence_gap",
    "recurrence_watch_escalated",
  ],
  independent_evidence_renewal: [
    "renewal_evidence_pending",
    "renewal_evidence_rechecked",
    "renewal_escalated",
  ],
  overdue_exception_reopening_audit: [
    "owner_reopening_required",
    "verified_reopening_linked",
  ],
};
export function normalizeVerifiedClosureMonitor(raw, now = new Date()) {
  const monitorKind = String(raw.monitorKind ?? "").trim();
  const outcomeKind = String(raw.outcomeKind ?? "").trim();
  if (!verifiedClosureMonitorOutcomes[monitorKind]?.includes(outcomeKind))
    throw new Error(
      "Invalid verified closure monitoring or reopening audit outcome.",
    );
  const prior = String(raw.priorMonitorId ?? "").trim();
  const reopen = String(raw.linkedReopenEventId ?? "").trim();
  if (!prior && monitorKind !== "verified_closure_recurrence_monitor")
    throw new Error(
      "Evidence renewal and reopening audits need a preceding closure monitor.",
    );
  if ((outcomeKind === "verified_reopening_linked") !== Boolean(reopen))
    throw new Error(
      "Verified reopening requires a linked owner reopening event; pending reviews cannot cite one.",
    );
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (outcomeKind === "verified_reopening_linked") {
    if (next)
      throw new Error("Verified reopening cannot retain an open due date.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter the next independent UTC follow-up date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error(
        "Closure monitoring and renewal must be due within 90 days.",
      );
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "verified closure monitor"),
    closureFollowupId: id(raw.closureFollowupId, "verified Build 132 closure"),
    priorMonitorId: prior ? id(prior, "previous monitoring receipt") : null,
    linkedReopenEventId: reopen ? id(reopen, "verified owner reopening") : null,
    ...pair(raw),
    monitorKind,
    outcomeKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Independent source evidence",
      8,
      400,
    ),
    monitorNote: note(
      raw.monitorNote,
      "Recurrence and renewal findings",
      12,
      800,
    ),
  };
}
export function classifyVerifiedClosureMonitorStatus(
  record,
  next,
  now = new Date(),
) {
  if (record.outcome_kind === "verified_reopening_linked")
    return "new_owner_reopening_independently_verified";
  if (next) return "subsequent_renewal_or_recheck_recorded";
  const due = new Date(record.next_due_at ?? "");
  if (!Number.isFinite(due.getTime()))
    return "closure_monitor_due_date_missing";
  const age = now.getTime() - due.getTime();
  if (age >= 30 * 86400000) return "closure_monitor_overdue_30_plus";
  if (age >= 0) return "closure_monitor_overdue";
  return record.monitor_kind === "verified_closure_recurrence_monitor"
    ? "verified_closure_recurrence_watch_pending"
    : record.monitor_kind === "independent_evidence_renewal"
      ? "independent_evidence_renewal_pending"
      : "owner_reopening_audit_pending";
}

const reopeningOversightOutcomes = {
  independent_reopening_followup: [
    "reopening_evidence_current",
    "reopening_evidence_gap",
    "reopening_followup_escalated",
  ],
  closure_recurrence_decision_replay: [
    "replay_continuity_confirmed",
    "replay_source_drift",
    "replay_owner_recheck_required",
  ],
  owner_escalation_oversight: [
    "owner_escalation_pending",
    "owner_escalation_renewed",
    "owner_escalation_resolved",
  ],
};
export function normalizeReopeningFollowupOversight(raw, now = new Date()) {
  const oversightKind = String(raw.oversightKind ?? "").trim();
  const outcomeKind = String(raw.outcomeKind ?? "").trim();
  if (!reopeningOversightOutcomes[oversightKind]?.includes(outcomeKind))
    throw new Error(
      "Invalid independent reopening follow-up or owner escalation outcome.",
    );
  const prior = String(raw.priorOversightId ?? "").trim();
  const verified = String(raw.verifiedResolutionEventId ?? "").trim();
  if (!prior && oversightKind !== "independent_reopening_followup")
    throw new Error(
      "Decision replay and owner escalation must follow an independent reopening review.",
    );
  if (
    ["replay_continuity_confirmed", "owner_escalation_resolved"].includes(
      outcomeKind,
    ) !== Boolean(verified)
  )
    throw new Error(
      "Source-verified replay or escalation closure needs its matching evidence event; open reviews cannot claim one.",
    );
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (outcomeKind === "owner_escalation_resolved") {
    if (next)
      throw new Error("Resolved owner escalation cannot retain a due date.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter the next independent UTC reopening review date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error(
        "Reopening evidence follow-up must be due within 90 days.",
      );
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "reopening follow-up receipt"),
    verifiedMonitorId: id(raw.verifiedMonitorId, "verified reopening monitor"),
    priorOversightId: prior ? id(prior, "prior oversight receipt") : null,
    verifiedResolutionEventId: verified
      ? id(verified, "verified source resolution event")
      : null,
    ...pair(raw),
    oversightKind,
    outcomeKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Reopening source evidence",
      8,
      400,
    ),
    oversightNote: note(
      raw.oversightNote,
      "Independent replay or escalation findings",
      12,
      800,
    ),
  };
}
export function classifyReopeningFollowupStatus(
  record,
  next,
  now = new Date(),
) {
  if (record.outcome_kind === "owner_escalation_resolved")
    return "source_verified_owner_escalation_resolution";
  if (next) return "subsequent_reopening_oversight_recorded";
  const due = new Date(record.next_due_at ?? "");
  if (!Number.isFinite(due.getTime()))
    return "reopening_followup_due_date_missing";
  const age = now.getTime() - due.getTime();
  if (age >= 30 * 86400000) return "reopening_followup_overdue_30_plus";
  if (age >= 0) return "reopening_followup_overdue";
  return record.oversight_kind === "independent_reopening_followup"
    ? "independent_reopening_evidence_watch_pending"
    : record.oversight_kind === "closure_recurrence_decision_replay"
      ? "closure_decision_replay_pending"
      : "owner_escalation_oversight_pending";
}

const escalationRenewalOutcomes = {
  independent_resolution_followup: [
    "resolution_evidence_current",
    "resolution_evidence_gap",
    "resolution_followup_escalated",
  ],
  reopening_recurrence_watch: [
    "recurrence_watch_stable",
    "reopening_recurrence_detected",
    "recurrence_escalation_required",
  ],
  owner_evidence_renewal: [
    "owner_evidence_renewed",
    "owner_evidence_pending",
    "owner_evidence_escalated",
  ],
};
export function normalizeEscalationResolutionRenewal(raw, now = new Date()) {
  const renewalKind = String(raw.renewalKind ?? "").trim();
  const outcomeKind = String(raw.outcomeKind ?? "").trim();
  if (!escalationRenewalOutcomes[renewalKind]?.includes(outcomeKind))
    throw new Error("Invalid independent escalation renewal outcome.");
  const prior = String(raw.priorRenewalId ?? "").trim();
  const proof = String(raw.renewalEvidenceEventId ?? "").trim();
  if (!prior && renewalKind !== "independent_resolution_followup")
    throw new Error(
      "Renewal must begin with an independent resolution follow-up.",
    );
  if (
    [
      "resolution_evidence_current",
      "recurrence_watch_stable",
      "owner_evidence_renewed",
    ].includes(outcomeKind) !== Boolean(proof)
  )
    throw new Error(
      "Stable or renewed outcomes need a fresh same-root source event; open findings cannot claim it.",
    );
  const next = String(raw.nextDueAt ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
    throw new Error("Enter the next independent UTC evidence review date.");
  const due = new Date(`${next}T23:59:00.000Z`);
  if (
    !Number.isFinite(due.getTime()) ||
    due.toISOString().slice(0, 10) !== next ||
    due <= now ||
    due.getTime() > now.getTime() + 90 * 86400000
  )
    throw new Error(
      "Independent escalation renewal must be due within 90 days.",
    );
  return {
    id: id(raw.id, "escalation renewal receipt"),
    resolvedOversightId: id(
      raw.resolvedOversightId,
      "resolved escalation receipt",
    ),
    priorRenewalId: prior ? id(prior, "prior renewal receipt") : null,
    renewalEvidenceEventId: proof ? id(proof, "renewed source evidence") : null,
    ...pair(raw),
    renewalKind,
    outcomeKind,
    nextDueAt: due.toISOString(),
    evidenceReference: note(
      raw.evidenceReference,
      "Renewal evidence reference",
      8,
      400,
    ),
    renewalNote: note(raw.renewalNote, "Independent renewal findings", 12, 800),
  };
}
export function classifyEscalationResolutionRenewalStatus(
  record,
  next,
  now = new Date(),
) {
  if (next) return "subsequent_independent_renewal_recorded";
  const due = new Date(record.next_due_at ?? "");
  if (!Number.isFinite(due.getTime()))
    return "escalation_renewal_due_date_missing";
  const age = now.getTime() - due.getTime();
  if (age >= 30 * 86400000) return "escalation_renewal_overdue_30_plus";
  if (age >= 0) return "escalation_renewal_overdue";
  return record.renewal_kind === "independent_resolution_followup"
    ? "independent_resolution_followup_pending"
    : record.renewal_kind === "reopening_recurrence_watch"
      ? "reopening_recurrence_watch_pending"
      : "owner_evidence_renewal_pending";
}

const renewalFreshnessAuditOutcomes = {
  independent_renewal_freshness_comparison: [
    "freshness_verified",
    "freshness_stale",
    "freshness_gap_escalated",
  ],
  reopening_watch_exception_reassessment: [
    "watch_no_exception",
    "watch_reopened_exception",
    "watch_escalation_required",
  ],
  owner_continuity_decision_audit: [
    "owner_continuity_confirmed",
    "owner_evidence_renewal_due",
    "owner_continuity_escalated",
  ],
};
export function normalizeRenewalFreshnessDecision(raw, now = new Date()) {
  const auditKind = String(raw.auditKind ?? "").trim();
  const outcomeKind = String(raw.outcomeKind ?? "").trim();
  if (!renewalFreshnessAuditOutcomes[auditKind]?.includes(outcomeKind))
    throw new Error("Invalid independent renewal freshness audit outcome.");
  const prior = String(raw.priorAuditId ?? "").trim();
  const proof = String(raw.comparisonEvidenceEventId ?? "").trim();
  if (!prior && auditKind !== "independent_renewal_freshness_comparison")
    throw new Error(
      "Reopening reassessment and owner continuity audit require a prior independent comparison.",
    );
  if ((outcomeKind === "freshness_verified") !== Boolean(proof))
    throw new Error(
      "Verified freshness needs a new source event; pending or escalated decisions cannot claim one.",
    );
  const next = String(raw.nextDueAt ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
    throw new Error("Enter the next UTC continuity review date.");
  const due = new Date(`${next}T23:59:00.000Z`);
  if (
    !Number.isFinite(due.getTime()) ||
    due.toISOString().slice(0, 10) !== next ||
    due <= now ||
    due.getTime() > now.getTime() + 90 * 86400000
  )
    throw new Error("Continuity follow-up must be due within 90 days.");
  return {
    id: id(raw.id, "freshness decision receipt"),
    ownerRenewalId: id(raw.ownerRenewalId, "owner evidence renewal"),
    priorAuditId: prior ? id(prior, "prior independent audit") : null,
    comparisonEvidenceEventId: proof ? id(proof, "new source evidence") : null,
    ...pair(raw),
    auditKind,
    outcomeKind,
    nextDueAt: due.toISOString(),
    evidenceReference: note(
      raw.evidenceReference,
      "Freshness evidence reference",
      8,
      400,
    ),
    auditNote: note(raw.auditNote, "Independent continuity decision", 12, 800),
  };
}
export function classifyRenewalFreshnessDecisionStatus(
  record,
  next,
  now = new Date(),
) {
  if (next) return "subsequent_freshness_or_continuity_audit_recorded";
  const due = new Date(record.next_due_at ?? "");
  if (!Number.isFinite(due.getTime()))
    return "renewal_continuity_due_date_missing";
  const age = now.getTime() - due.getTime();
  if (age >= 30 * 86400000) return "renewal_continuity_overdue_30_plus";
  if (age >= 0) return "renewal_continuity_overdue";
  return record.audit_kind === "independent_renewal_freshness_comparison"
    ? "independent_freshness_comparison_pending"
    : record.audit_kind === "reopening_watch_exception_reassessment"
      ? "reopening_exception_reassessment_pending"
      : "owner_continuity_decision_pending";
}
