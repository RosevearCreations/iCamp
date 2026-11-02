export interface MarketDashboard {
  campground: {
    id: string;
    organization_id: string;
    name: string;
    lifecycle_state: string;
  };
  units: Array<{
    id: string;
    code: string;
    display_name: string;
    lifecycle_state: string;
  }>;
  ownership: Array<{
    id: string;
    accommodation_id: string;
    event_kind: string;
    owner_display_name: string;
    evidence_reference: string;
    notes: string;
    recorded_at: string;
  }>;
  listings: Array<{
    id: string;
    accommodation_id: string;
    ownership_event_id: string;
    listing_status: string;
    headline: string;
    description: string;
    asking_price_cents: string;
    currency_code: string;
    approval_note: string | null;
    created_by_user_id: string;
  }>;
  inquiries: Array<{
    id: string;
    listing_id: string;
    buyer_display_name: string;
    contact_reference: string;
    inquiry_note: string;
    inquiry_state: string;
  }>;
}
export function getPermanentUnitMarket(
  userId: string,
  campgroundId: string,
): Promise<MarketDashboard>;
export function recordPermanentUnitOwner(
  input: Record<string, unknown>,
): Promise<string>;
export function draftPermanentUnitListing(
  input: Record<string, unknown>,
): Promise<string>;
export function reviewPermanentUnitListing(
  input: Record<string, unknown>,
): Promise<string>;
export function recordPermanentUnitInquiry(
  input: Record<string, unknown>,
): Promise<string>;
export function closePermanentUnitPoolForTests(): Promise<void>;
