export interface LongTermAssignmentOption {
  id: string;
  code: string;
  displayName: string;
  accommodationKind: "campsite" | "permanent_unit";
  stayProfile: "seasonal" | "yearly" | null;
}

export interface LongTermRatePlanOption {
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
}

export interface LongTermAssignment {
  id: string;
  organizationId: string;
  campgroundId: string;
  accommodationId: string;
  accommodationCode: string;
  accommodationName: string;
  accommodationKind: "campsite" | "permanent_unit";
  assignmentKind: "seasonal" | "yearly";
  assignmentState: "active" | "ended" | "cancelled";
  occupancyState: "assigned" | "temporarily_vacant" | "winter_closed";
  occupantDisplayName: string;
  contactEmail: string | null;
  startsOn: string;
  endsOn: string;
  ratePlanId: string | null;
  chargeAmountCents: number | null;
  currencyCode: string;
  chargeDueOn: string | null;
  reference: string | null;
  notes: string | null;
  winterizationRequired: boolean;
  rowVersion: number;
}

export function closeLongTermAssignmentPoolForTests(): Promise<void>;

export function listLongTermAssignmentOptions(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  accommodations: LongTermAssignmentOption[];
  ratePlans: LongTermRatePlanOption[];
}>;

export function listLongTermAssignments(input: {
  userId: string;
  campgroundId: string;
}): Promise<LongTermAssignment[]>;

export function createLongTermAssignment(input: {
  actorUserId: string;
  campgroundId: string;
  input: {
    accommodationId: string;
    assignmentKind: "seasonal" | "yearly";
    occupantDisplayName: string;
    contactEmail?: string | null;
    startsOn: string;
    endsOn: string;
    ratePlanId: string;
    chargeAmountCents?: number | string | null;
    currencyCode?: string | null;
    chargeDueOn?: string | null;
    reference?: string | null;
    notes?: string | null;
    winterizationRequired?: boolean | string;
  };
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "import" | "system";
}): Promise<
  Record<string, unknown> & {
    id: string;
    canonicalChargeAmountCents: number;
    canonicalCurrencyCode: string;
  }
>;

export function transitionLongTermAssignment(input: {
  actorUserId: string;
  campgroundId: string;
  input: {
    assignmentId: string;
    eventKind: "winter_closed" | "reopened" | "ended" | "cancelled";
    effectiveOn: string;
    note?: string | null;
    expectedRowVersion?: number | string | null;
  };
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "import" | "system";
}): Promise<
  Record<string, unknown> & {
    id: string;
    assignment_state: "active" | "ended" | "cancelled";
    occupancy_state: "assigned" | "temporarily_vacant" | "winter_closed";
    row_version: number;
  }
>;
