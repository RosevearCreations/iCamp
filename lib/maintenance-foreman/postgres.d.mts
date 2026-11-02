export interface MaintenanceForemanQueue {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  generatedAt: string;
  actorResponsibilityLevel: string;
  actorResponsibilityRank: number;
  staff: Array<{
    id: string;
    label: string;
    responsibilityLevel: string;
    responsibilityRank: number;
    assignable: boolean;
  }>;
  policies: Array<{
    id: string;
    triggerKey: string;
    targetLevel: string;
    thresholdMinutes: number;
    isActive: boolean;
    instructions: string | null;
    rowVersion: number;
  }>;
  workOrders: Array<{
    id: string;
    title: string;
    categoryName: string;
    priorityKey: string;
    status: string;
    assignedToUserId: string | null;
    responseDueAt: string;
    completionDueAt: string;
    respondedAt: string | null;
    createdAt: string;
    updatedAt: string;
    rowVersion: number;
    signals: Array<{
      triggerKey: string;
      targetLevel: string;
      thresholdMinutes: number;
      eligibleAt: string;
    }>;
    activeEscalations: Array<{
      id: string;
      workOrderId: string;
      triggerKey: string;
      targetLevel: string;
      state: string;
      raisedByUserId: string;
      raisedAt: string;
      acknowledgementNote: string | null;
      acknowledgedByUserId: string | null;
      acknowledgedAt: string | null;
      resolutionNote: string | null;
      resolvedByUserId: string | null;
      resolvedAt: string | null;
      rowVersion: number;
    }>;
    hasResponseOverdue: boolean;
    hasCompletionOverdue: boolean;
  }>;
  activeEscalations: Array<{
    id: string;
    workOrderId: string;
    triggerKey: string;
    targetLevel: string;
    state: string;
    raisedByUserId: string;
    raisedAt: string;
    acknowledgementNote: string | null;
    acknowledgedByUserId: string | null;
    acknowledgedAt: string | null;
    resolutionNote: string | null;
    resolvedByUserId: string | null;
    resolvedAt: string | null;
    rowVersion: number;
  }>;
}

export function closeMaintenanceForemanPoolForTests(): Promise<void>;

export function getMaintenanceForemanQueue(
  userId: string,
  campgroundId: string,
): Promise<MaintenanceForemanQueue>;

export function raiseMaintenanceEscalation(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  workOrderId: string;
  triggerKey: string;
}): Promise<void>;

export function acknowledgeMaintenanceEscalation(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  escalationId: string;
  expectedRowVersion: number;
  note?: string | null;
}): Promise<void>;

export function resolveMaintenanceEscalation(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  escalationId: string;
  expectedRowVersion: number;
  note: string;
}): Promise<void>;

export function updateMaintenanceEscalationPolicy(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  policyId: string;
  targetLevel: string;
  thresholdMinutes: number | string;
  isActive: boolean;
  instructions?: string | null;
  expectedRowVersion: number;
}): Promise<void>;
