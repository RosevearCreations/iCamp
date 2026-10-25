// Advisory evidence reconciliation. This never authorizes an opening or a booking.
export function reconcileSpringOwnerReview({
  campgroundActive,
  accommodations,
  assignments,
  closureEvents,
  inspections,
  decisions,
  availability,
}) {
  const latestClosure = new Map();
  for (const event of closureEvents) {
    if (!latestClosure.has(event.assignment_id))
      latestClosure.set(event.assignment_id, event.id);
  }
  const availabilityBySite = new Map(
    (availability?.items ?? []).map((item) => [item.accommodationId, item]),
  );
  return accommodations.map((site) => {
    const related = assignments.filter((a) => a.accommodation_id === site.id);
    const currentInspections = inspections.filter((inspection) => {
      if (inspection.accommodation_id !== site.id) return false;
      if (!inspection.assignment_id) return true;
      return (
        latestClosure.get(inspection.assignment_id) ===
        inspection.winter_close_event_id
      );
    });
    const approved = currentInspections.some((inspection) =>
      decisions.some(
        (decision) =>
          decision.inspection_id === inspection.id &&
          decision.decision === "approved",
      ),
    );
    const booking = availabilityBySite.get(site.id);
    const blockers = [];
    if (!campgroundActive) blockers.push("inactive_campground");
    if (site.lifecycle_state !== "active")
      blockers.push("inactive_accommodation");
    if (related.some((a) => a.occupancy_state === "winter_closed"))
      blockers.push("winter_closed_assignment");
    if (!approved) blockers.push("spring_evidence_not_approved");
    if (!booking) blockers.push("availability_not_verified");
    else blockers.push(...booking.blockers);
    return {
      accommodationId: site.id,
      code: site.code,
      approved,
      blockers: [...new Set(blockers)],
      // No automated owner sign-off: this is a review aid, never a release gate.
      reviewState: blockers.length
        ? "requires_review"
        : "ready_for_owner_review",
    };
  });
}
