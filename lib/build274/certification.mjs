// Build 274: evidence classification never upgrades a source count into a live certification.
export function classify274(source, ownerSession) {
  const stage = (ok, detail) => ({
    status: ok ? "EVIDENCE_PRESENT_REVIEW_REQUIRED" : "HOLD",
    detail,
  });
  const checks = [
    {
      id: "original-host",
      ...stage(
        source.hostPinned && source.adopted,
        "Original database pin and migration 0248 must both be independently witnessed.",
      ),
    },
    {
      id: "owner-session",
      ...stage(
        ownerSession?.originalRosevear === true && ownerSession?.aal2 === true,
        "A genuine Rosevear staff login with verified MFA AAL2 is required; deployment and a recovery secret are not proof.",
      ),
    },
    {
      id: "booking",
      ...stage(
        source.bookingSignerConfigured && source.consumerAck > 0,
        "Original booking signer, same-tenant source pairing and provider acknowledgment need independent verification.",
      ),
    },
    {
      id: "comms",
      ...stage(
        source.commsSignerConfigured && source.consumerAck > 0,
        "Original Comms signer, delivered recipient acknowledgment and source custody need independent verification.",
      ),
    },
    {
      id: "incident",
      ...stage(
        source.incidentClosed > 0,
        "Only an already-resolved original incident with independent signed ACK may be certified.",
      ),
    },
    {
      id: "restore",
      ...stage(
        source.restoreSignerConfigured && source.providerRestore > 0,
        "Restore provider signature, original/isolated host separation and independent reviewer required.",
      ),
    },
    {
      id: "seven-source",
      status: "HOLD",
      detail:
        "Require seven independently authenticated and current source-specific handshake receipts; aggregate counts cannot prove seven-of-seven.",
    },
  ];
  return {
    status: "PENDING_INDEPENDENT_LIVE_ACCEPTANCE",
    checks,
    sourceStatus: source.status,
  };
}
