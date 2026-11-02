export interface SaleDashboard {
  campground: {
    id: string;
    name: string;
    lifecycle_state: string;
    organization_id: string;
  };
  cases: Array<{
    id: string;
    accommodation_id: string;
    listing_id: string;
    inquiry_id: string;
    buyer_display_name: string;
    application_reference: string;
    application_note: string;
    opened_by_user_id: string;
  }>;
  evidence: Array<{
    id: string;
    case_id: string;
    step_key: string;
    outcome: string;
    source_reference: string;
    note: string;
    fee_amount_cents: string | null;
  }>;
  decisions: Array<{
    id: string;
    case_id: string;
    decision: string;
    note: string;
    reviewed_by_user_id: string;
  }>;
  handoffs: Array<{
    id: string;
    case_id: string;
    new_ownership_event_id: string;
    agreement_reference: string;
    closing_reference: string;
    note: string;
  }>;
}
export function getSaleTransferDashboard(
  userId: string,
  campgroundId: string,
): Promise<SaleDashboard>;
export function openSaleTransfer(
  input: Record<string, unknown>,
): Promise<string>;
export function recordSaleEvidence(
  input: Record<string, unknown>,
): Promise<string>;
export function reviewSaleTransfer(
  input: Record<string, unknown>,
): Promise<string>;
export function finalizeSaleTransfer(
  input: Record<string, unknown>,
): Promise<string>;
export function closePermanentUnitTransferPoolForTests(): Promise<void>;
