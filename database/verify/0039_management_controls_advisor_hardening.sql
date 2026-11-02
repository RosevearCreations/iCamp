-- iCamp Build 031 advisor hardening verification.
do $verify$
declare
  missing_index_count integer;
  duplicate_policy_count integer;
begin
  select count(*)
  into missing_index_count
  from (
    values
      ('management_restrictions_accommodation_scope_fk_idx'),
      ('management_restrictions_asset_scope_fk_idx'),
      ('management_restrictions_section_scope_fk_idx'),
      ('management_restrictions_supersedes_idx'),
      ('campground_map_publication_events_from_fk_idx'),
      ('campground_map_publication_events_to_fk_idx')
  ) expected(index_name)
  where to_regclass(
    case
      when index_name like 'campground_map_publication_events%'
        then 'icamp_private.' || index_name
      else 'public.' || index_name
    end
  ) is null;

  if missing_index_count <> 0 then
    raise exception 'Build 031 advisor hardening indexes are incomplete';
  end if;

  select count(*)
  into duplicate_policy_count
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'accommodations_management_operations_read',
      'operational_assets_management_operations_read',
      'campground_sections_management_operations_read'
    );

  if duplicate_policy_count <> 0 then
    raise exception 'Build 031 duplicate permissive policies remain';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'accommodations'
      and policyname = 'accommodations_read'
      and qual like '%campground.operations.manage%'
  ) then
    raise exception 'Build 031 operations permission missing from accommodation read policy';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'operational_assets'
      and policyname = 'operational_assets_read'
      and qual like '%campground.operations.manage%'
  ) then
    raise exception 'Build 031 operations permission missing from asset read policy';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'campground_sections'
      and policyname = 'campground_sections_assigned_select'
      and qual like '%campground.operations.manage%'
  ) then
    raise exception 'Build 031 operations permission missing from section read policy';
  end if;
end
$verify$;
