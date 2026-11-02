-- Build 188 follow-up: cover the complete scoped credential foreign key.
-- The history index serves campground board queries; this index serves FK checks.
create index access_reconciliation_reviews_credential_fk_idx
 on icamp_private.access_reconciliation_reviews(organization_id,campground_id,credential_id);
