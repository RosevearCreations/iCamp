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
