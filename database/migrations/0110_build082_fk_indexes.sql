-- Build 082 performance advisor follow-up: index composite scoped foreign keys.
create index campground_rule_sets_facility_scope_fk_idx
 on public.campground_rule_sets(organization_id,campground_id,facility_id)
 where facility_id is not null;
create index campground_rule_ack_version_scope_fk_idx
 on public.campground_rule_acknowledgements(organization_id,campground_id,rule_set_id,rule_version_id);
create index campground_rule_ack_reservation_scope_fk_idx
 on public.campground_rule_acknowledgements(organization_id,campground_id,reservation_id);
