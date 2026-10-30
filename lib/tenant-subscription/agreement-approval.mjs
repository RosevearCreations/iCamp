/** Preview-only separation-of-duties agreement workflow, never an actual approval. */
export function createAgreementReview({ version, contentSha256 }) {
  if (
    typeof version !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/.test(version)
  ) {
    throw new Error("Agreement version must be a bounded explicit identifier.");
  }
  if (
    typeof contentSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(contentSha256)
  ) {
    throw new Error("Agreement content must be bound to a SHA-256 digest.");
  }
  return Object.freeze({
    schema: "icamp.agreement.review-preview.v1",
    version,
    content_sha256: contentSha256,
    state: "draft",
    revision: 0,
    actors: Object.freeze({}),
    history: Object.freeze([]),
    independently_verified: false,
    legally_approved: false,
    published: false,
    persisted: false,
  });
}

export function previewAgreementDecision(
  previous,
  { action, actor, expectedRevision } = {},
) {
  if (previous?.schema !== "icamp.agreement.review-preview.v1")
    throw new Error("Unknown agreement review snapshot.");
  if (
    !Number.isInteger(expectedRevision) ||
    previous.revision !== expectedRevision
  )
    throw new Error("Stale agreement review revision.");
  if (typeof actor !== "string" || !/^[a-zA-Z0-9_-]{3,64}$/.test(actor))
    throw new Error("Reviewer identifier must be explicit.");
  const steps = {
    submit: ["draft", "submitted"],
    review: ["submitted", "reviewed"],
    approve: ["reviewed", "approval_previewed"],
    request_changes: ["submitted", "draft"],
    reject: ["reviewed", "rejected"],
  };
  const transition = steps[action];
  if (!transition || previous.state !== transition[0])
    throw new Error("Invalid agreement decision transition.");
  if (action === "review" && actor === previous.actors.submit)
    throw new Error("Independent reviewer must differ from submitter.");
  if (
    action === "approve" &&
    [previous.actors.submit, previous.actors.review].includes(actor)
  ) {
    throw new Error(
      "Final approver must be distinct from submitter and reviewer.",
    );
  }
  const actors = { ...previous.actors, [action]: actor };
  if (action === "request_changes") {
    delete actors.submit;
    delete actors.review;
  }
  return Object.freeze({
    ...previous,
    state: transition[1],
    revision: previous.revision + 1,
    actors: Object.freeze(actors),
    history: Object.freeze([
      ...previous.history,
      Object.freeze({ action, actor, revision: previous.revision + 1 }),
    ]),
  });
}
