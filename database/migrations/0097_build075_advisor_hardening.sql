-- iCamp Build 075 advisor hardening.
-- Add covering indexes for the three scoped foreign keys reported by the
-- Supabase Performance Advisor after the preventive-maintenance migration.

create index if not exists preventive_maintenance_programs_scope_asset_fk_idx
  on public.preventive_maintenance_programs(
    organization_id,
    campground_id,
    asset_id
  );

create index if not exists preventive_maintenance_programs_scope_template_fk_idx
  on public.preventive_maintenance_programs(
    organization_id,
    campground_id,
    template_id
  );

create index if not exists preventive_maintenance_programs_scope_schedule_fk_idx
  on public.preventive_maintenance_programs(
    organization_id,
    campground_id,
    maintenance_schedule_id
  );
