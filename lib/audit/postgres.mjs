function optionalJson(value) {
  return value == null ? null : JSON.stringify(value);
}

export async function appendAuditEvent(
  client,
  {
    actorUserId = null,
    actorSessionId = null,
    organizationId = null,
    campgroundId = null,
    actionKey,
    permissionKey = null,
    riskLevel = "standard",
    outcome = "succeeded",
    reason = null,
    subjectType = null,
    subjectId = null,
    requestId = null,
    beforeState = null,
    afterState = null,
    metadata = {},
    reauthenticatedAt = null,
    assuranceLevel = null,
  },
) {
  if (!client?.query) {
    throw new Error("A database transaction client is required for audit writes.");
  }

  const result = await client.query(
    `insert into icamp_private.audit_events (
       actor_user_id,
       actor_session_id,
       organization_id,
       campground_id,
       action_key,
       permission_key,
       risk_level,
       outcome,
       reason,
       subject_type,
       subject_id,
       request_id,
       before_state,
       after_state,
       metadata,
       reauthenticated_at,
       assurance_level
     )
     values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9,
       $10, $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17
     )
     returning id, occurred_at`,
    [
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey,
      permissionKey,
      riskLevel,
      outcome,
      reason,
      subjectType,
      subjectId == null ? null : String(subjectId),
      requestId,
      optionalJson(beforeState),
      optionalJson(afterState),
      JSON.stringify(metadata ?? {}),
      reauthenticatedAt,
      assuranceLevel,
    ],
  );

  return {
    id: result.rows[0].id,
    occurredAt: result.rows[0].occurred_at,
  };
}
