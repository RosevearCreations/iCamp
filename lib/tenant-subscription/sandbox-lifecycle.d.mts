export interface SandboxSnapshot {
  readonly schema: "icamp.subscription.sandbox-replay.v1";
  readonly tenant_key: string;
  readonly subscription_state: string;
  readonly payment_state: string;
  readonly risk_state: string;
  readonly processed_ids: readonly string[];
  readonly history: readonly { readonly id: string; readonly type: string }[];
  readonly simulated: true;
  readonly persisted: false;
  readonly external_writes: false;
  readonly charges_enabled: false;
}
export const SANDBOX_LIFECYCLE_EVENTS: readonly string[];
export function createSandboxLifecycle(tenantKey: string): SandboxSnapshot;
export function replaySandboxEvent(
  previous: SandboxSnapshot,
  event: { tenantKey: string; id: string; type: string; status?: string },
): SandboxSnapshot;
export function runSandboxLifecycleFixture(): SandboxSnapshot & {
  fixture_events: number;
  live_provider_connected: false;
};
