/**
 * Pure, isolated event replay for sandbox validation. It never contacts a
 * provider, creates a payment, activates a tenant, or ingests webhooks.
 */
const SANDBOX_EVENTS = Object.freeze([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
]);

export function createSandboxLifecycle(tenantKey) {
  if (
    typeof tenantKey !== "string" ||
    !/^[a-zA-Z0-9_-]{3,64}$/.test(tenantKey)
  ) {
    throw new Error("Sandbox tenant key must be a bounded identifier.");
  }
  return Object.freeze({
    schema: "icamp.subscription.sandbox-replay.v1",
    tenant_key: tenantKey,
    subscription_state: "none",
    payment_state: "not_attempted",
    risk_state: "normal",
    processed_ids: Object.freeze([]),
    history: Object.freeze([]),
    simulated: true,
    persisted: false,
    external_writes: false,
    charges_enabled: false,
  });
}

export function replaySandboxEvent(previous, event) {
  if (previous?.schema !== "icamp.subscription.sandbox-replay.v1") {
    throw new Error("Expected an isolated sandbox lifecycle snapshot.");
  }
  if (event?.tenantKey !== previous.tenant_key) {
    throw new Error("Sandbox tenant isolation violation.");
  }
  if (typeof event.id !== "string" || !/^[a-zA-Z0-9_-]{3,80}$/.test(event.id)) {
    throw new Error("Sandbox event id is missing or invalid.");
  }
  if (!SANDBOX_EVENTS.includes(event.type)) {
    throw new Error(
      "Event is outside the reviewed sandbox lifecycle allowlist.",
    );
  }
  if (previous.processed_ids.includes(event.id)) {
    return previous; // duplicate delivery: no state change or second receipt
  }
  let subscription = previous.subscription_state;
  let payment = previous.payment_state;
  let risk = previous.risk_state;
  switch (event.type) {
    case "checkout.session.completed":
      if (subscription !== "none") throw new Error("Checkout is out of order.");
      subscription = "checkout_completed";
      break;
    case "customer.subscription.created":
      if (!["none", "checkout_completed"].includes(subscription))
        throw new Error("Subscription creation is out of order.");
      subscription = "trialing";
      break;
    case "customer.subscription.updated":
      if (!["trialing", "active", "past_due"].includes(subscription))
        throw new Error("Subscription update is out of order.");
      if (!["trialing", "active", "past_due"].includes(event.status))
        throw new Error("Unsupported sandbox subscription status.");
      subscription = event.status;
      break;
    case "invoice.paid":
      if (!["trialing", "active", "past_due"].includes(subscription))
        throw new Error("Paid invoice is out of order.");
      subscription = "active";
      payment = "paid_in_sandbox";
      break;
    case "invoice.payment_failed":
      if (!["trialing", "active", "past_due"].includes(subscription))
        throw new Error("Failed invoice is out of order.");
      subscription = "past_due";
      payment = "failed_in_sandbox";
      break;
    case "customer.subscription.deleted":
      if (!["trialing", "active", "past_due"].includes(subscription))
        throw new Error("Cancellation is out of order.");
      subscription = "canceled";
      break;
    case "charge.refunded":
      if (payment !== "paid_in_sandbox")
        throw new Error("A sandbox refund requires an earlier paid invoice.");
      payment = "refunded_in_sandbox";
      if (risk !== "dispute_open") risk = "review_required";
      break;
    case "charge.dispute.created":
      if (!["paid_in_sandbox", "refunded_in_sandbox"].includes(payment))
        throw new Error("A sandbox dispute requires earlier payment.");
      risk = "dispute_open";
      break;
  }
  return Object.freeze({
    ...previous,
    subscription_state: subscription,
    payment_state: payment,
    risk_state: risk,
    processed_ids: Object.freeze([...previous.processed_ids, event.id]),
    history: Object.freeze([
      ...previous.history,
      Object.freeze({ id: event.id, type: event.type }),
    ]),
  });
}

export function runSandboxLifecycleFixture() {
  const tenantKey = "test_camp_rosevear";
  const stream = [
    ["evt_001", "checkout.session.completed"],
    ["evt_002", "customer.subscription.created"],
    ["evt_003", "invoice.paid"],
    ["evt_004", "invoice.payment_failed"],
    ["evt_005", "invoice.paid"],
    ["evt_006", "customer.subscription.deleted"],
  ];
  const result = stream.reduce(
    (state, [id, type]) => replaySandboxEvent(state, { tenantKey, id, type }),
    createSandboxLifecycle(tenantKey),
  );
  return Object.freeze({
    ...result,
    fixture_events: stream.length,
    live_provider_connected: false,
  });
}

export const SANDBOX_LIFECYCLE_EVENTS = SANDBOX_EVENTS;
