-- Build 191 hosted advisor follow-up. Cover the full campground-scoped
-- self-referential foreign keys used for immutable contract/plan replacement.
create index vendor_contract_supersedes_scope_fk_idx
 on icamp_private.vendor_contracts(organization_id,campground_id,supersedes_contract_id);
create index vendor_recurring_supersedes_scope_fk_idx
 on icamp_private.vendor_recurring_plans(organization_id,campground_id,supersedes_plan_id);
