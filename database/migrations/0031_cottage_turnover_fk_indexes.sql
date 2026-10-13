-- iCamp Build 027
-- Cover the composite foreign keys identified by the hosted Supabase
-- performance advisor after the cottage turnover migration.

create index cottage_turnovers_template_scope_idx
  on public.cottage_turnovers (
    organization_id,
    campground_id,
    template_id
  );

create index cottage_turnover_item_checks_source_scope_idx
  on public.cottage_turnover_item_checks (
    organization_id,
    campground_id,
    checklist_item_id
  );

create index cottage_turnover_item_checks_cottage_idx
  on public.cottage_turnover_item_checks (
    organization_id,
    campground_id,
    accommodation_id
  );
