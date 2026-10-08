export type WorkflowParityChannel = "ivr" | "sms";
export type WorkflowSupportLevel =
  | "full"
  | "guided"
  | "secure-link"
  | "staff-transfer"
  | "not-applicable";
export type WorkflowAudience = "guest" | "staff" | "management";

export interface WorkflowDefinition {
  readonly id: string;
  readonly title: string;
  readonly audience: WorkflowAudience;
  readonly command: string;
  readonly support: Readonly<{
    web: WorkflowSupportLevel;
    ivr: WorkflowSupportLevel;
    sms: WorkflowSupportLevel;
  }>;
  readonly requiresVerification?: boolean;
  readonly visualOnly?: boolean;
  readonly secureLinkPurpose?: string;
  readonly reason?: string;
}

export interface WorkflowInvocation {
  workflowId: string;
  actor?: unknown;
  campgroundId?: string;
  input?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface CanonicalCommandInvocation {
  workflowId: string;
  command: string;
  actor?: unknown;
  campgroundId?: string;
  input: Record<string, unknown>;
  context: Record<string, unknown>;
  channel: WorkflowParityChannel;
  support: WorkflowSupportLevel;
  requiresVerification: boolean;
}

export interface WorkflowAdapterDependencies {
  executeCanonicalCommand(
    invocation: CanonicalCommandInvocation,
  ): Promise<unknown> | unknown;
  createSecureLink?: (request: {
    workflowId: string;
    purpose: string;
    actor?: unknown;
    campgroundId?: string;
    context: Record<string, unknown>;
  }) => Promise<unknown> | unknown;
  requestStaffTransfer?: (request: {
    workflowId: string;
    actor?: unknown;
    campgroundId?: string;
    context: Record<string, unknown>;
    reason: string;
  }) => Promise<unknown> | unknown;
}

export interface WorkflowAdapter {
  readonly channel: WorkflowParityChannel;
  invoke(request: WorkflowInvocation): Promise<{
    kind: "canonical-command" | "secure-link" | "staff-transfer";
    workflowId: string;
    channel: WorkflowParityChannel;
    support: WorkflowSupportLevel;
    command?: string;
    result?: unknown;
    handoff?: unknown;
    transfer?: unknown;
    reason?: string;
  }>;
}

export const workflowParityMatrix: readonly WorkflowDefinition[];

export function getWorkflowDefinition(workflowId: string): WorkflowDefinition;
export function assertWorkflowParityRegistry(): true;
export function createIvrWorkflowAdapter(
  dependencies: WorkflowAdapterDependencies,
): WorkflowAdapter;
export function createSmsWorkflowAdapter(
  dependencies: WorkflowAdapterDependencies,
): WorkflowAdapter;
export function getWorkflowParityHealth(): Readonly<{
  status: "ready";
  workflows: number;
  canonicalCommands: number;
  graphicalOnly: number;
  byAudience: Readonly<{
    guest: number;
    staff: number;
    management: number;
  }>;
  byChannel: Readonly<
    Record<
      "web" | "ivr" | "sms",
      Readonly<Record<WorkflowSupportLevel, number>>
    >
  >;
  safeguards: Readonly<{
    canonicalDomainCommandsOnly: true;
    visualStepsUseHandoff: true;
    staffFallbackAvailable: true;
    callerOrSenderHintIsAuthentication: false;
  }>;
}>;
