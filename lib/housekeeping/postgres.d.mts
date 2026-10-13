export interface CottageInventoryChecklistItem {
  id: string;
  category:
    | "linen"
    | "kitchen"
    | "bathroom"
    | "safety"
    | "security"
    | "equipment"
    | "consumable"
    | "other";
  name: string;
  requiredQuantity: number;
  unit: string;
  expectedCondition: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  rowVersion: number;
}

export interface CottageTurnoverItemCheck {
  id: string;
  checklistItemId: string;
  category: string;
  name: string;
  requiredQuantity: number;
  unit: string;
  expectedCondition: string;
  isRequired: boolean;
  checked: boolean;
  issueFound: boolean;
  notes: string;
  checkedAt: string | Date | null;
  rowVersion: number;
}

export interface CottageDamageInspection {
  id: string;
  result: "pass" | "issues_found";
  linenComplete: boolean;
  housekeepingComplete: boolean;
  inventoryComplete: boolean;
  damageFound: boolean;
  securityIssueFound: boolean;
  damageNotes: string;
  securityNotes: string;
  inspectedAt: string | Date;
  rowVersion: number;
}

export interface CottageHousekeepingTemplate {
  id: string;
  name: string;
  turnoverType:
    | "departure"
    | "deep_clean"
    | "winter_open"
    | "winter_close"
    | "maintenance_reset";
  expectedMinutes: number;
  linenRequirements: string;
  housekeepingRequirements: string;
  damageInspectionRequired: boolean;
  securityInspectionRequired: boolean;
  isActive: boolean;
  rowVersion: number;
  items: CottageInventoryChecklistItem[];
}

export interface CottageTurnover {
  id: string;
  templateId: string;
  status:
    | "scheduled"
    | "in_progress"
    | "inspection"
    | "blocked"
    | "ready"
    | "cancelled";
  scheduledFor: string | Date;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  notes: string;
  blockedReason: string;
  rowVersion: number;
  itemChecks: CottageTurnoverItemCheck[];
  inspections: CottageDamageInspection[];
}

export interface CottageHousekeepingState {
  accommodationId: string;
  templates: CottageHousekeepingTemplate[];
  turnovers: CottageTurnover[];
}

export function closeCottageHousekeepingPoolForTests(): Promise<void>;

export function listCottageHousekeeping(
  userId: string,
  campgroundId: string,
): Promise<CottageHousekeepingState[]>;

export function createCottageHousekeepingTemplate(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  accommodationId: string;
  name: string;
  turnoverType: string;
  expectedMinutes: number | string;
  linenRequirements?: string;
  housekeepingRequirements?: string;
  damageInspectionRequired?: boolean;
  securityInspectionRequired?: boolean;
}): Promise<string>;

export function addCottageInventoryChecklistItem(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  templateId: string;
  category: string;
  name: string;
  requiredQuantity: number | string;
  unit: string;
  expectedCondition?: string;
  sortOrder: number | string;
  isRequired?: boolean;
}): Promise<string>;

export function createCottageTurnover(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  templateId: string;
  notes?: string;
}): Promise<string>;

export function recordCottageTurnoverItemCheck(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  turnoverId: string;
  checkId: string;
  issueFound?: boolean;
  notes?: string;
}): Promise<number>;

export function recordCottageDamageInspection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  turnoverId: string;
  linenComplete?: boolean;
  housekeepingComplete?: boolean;
  damageFound?: boolean;
  securityIssueFound?: boolean;
  damageNotes?: string;
  securityNotes?: string;
}): Promise<{ status: string; inspectionId: string }>;
