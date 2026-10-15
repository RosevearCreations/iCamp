export interface SeasonalRatePlan {
  id: string;
  code: string;
  displayName: string;
  accommodationId: string | null;
  accommodationKind: string | null;
  currencyCode: string;
  seasonalCents: number | null;
  yearlyCents: number | null;
  startsOn: string;
  endsOn: string;
  priority: number;
}

export interface SeasonalAssignmentConsole {
  campground: { id: string; name: string };
  accommodations: Array<{
    id: string;
    code: string;
    displayName: string;
    accommodationKind: string;
  }>;
  ratePlans: SeasonalRatePlan[];
  assignments: Array<{
    id: string;
    accommodationId: string;
    accommodationCode: string;
    accommodationName: string;
    accommodationKind: string;
    startsOn: string;
    endsOn: string;
    assignmentState: "active" | "ended" | "cancelled";
    assignmentKind: "seasonal" | "yearly";
    occupantDisplayName: string | null;
    reference: string | null;
    winterizationRequired: boolean;
    sourceChannel: string;
    rowVersion: number;
    charge: null | {
      id: string;
      ratePlanId: string;
      ratePlanCode: string;
      chargePeriod: "seasonal" | "yearly";
      currencyCode: string;
      amountCents: number;
      dueOn: string;
    };
  }>;
  events: Array<{
    id: string;
    assignmentId: string;
    eventKind: "created" | "ended" | "cancelled";
    fromState: "active" | "ended" | "cancelled" | null;
    toState: "active" | "ended" | "cancelled";
    sourceChannel: string;
    reason: string;
    occurredAt: string;
  }>;
}

export function closeSeasonalAssignmentPoolForTests(): Promise<void>;

export function listSeasonalAssignmentConsole(input: {
  userId: string;
  campgroundId: string;
}): Promise<SeasonalAssignmentConsole>;

export function createSeasonalAssignment(input: {
  actorUserId: string;
  campgroundId: string;
  input: {
    accommodationId: string;
    assignmentKind: "seasonal" | "yearly";
    startsOn: string;
    endsOn: string;
    occupantDisplayName: string;
    reference?: string | null;
    ratePlanId: string;
    winterizationRequired?: boolean | string;
  };
  reason: string;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "import" | "system";
}): Promise<{
  assignmentId: string;
  amountCents: number;
  currencyCode: string;
}>;

export function transitionSeasonalAssignment(input: {
  actorUserId: string;
  campgroundId: string;
  assignmentId: string;
  expectedRowVersion: number | string;
  action: "end" | "cancel";
  reason: string;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "import" | "system";
}): Promise<{
  assignmentId: string;
  idempotent: boolean;
  assignmentState: "ended" | "cancelled";
}>;
