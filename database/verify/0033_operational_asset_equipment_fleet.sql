-- iCamp Build 029 verification.
do $verify$
begin
  if to_regclass('public.operational_assets') is null then
    raise exception 'operational_assets table is missing';
  end if;
  if to_regclass('public.operational_facilities') is null then
    raise exception 'operational_facilities table is missing';
  end if;
  if to_regclass('public.operational_equipment') is null then
    raise exception 'operational_equipment table is missing';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = 'public.operational_assets'::regclass
      and relrowsecurity and relforcerowsecurity
  ) then
    raise exception 'operational_assets must force RLS';
  end if;
  if not exists (select 1 from icamp_private.permission_catalog where permission_key = 'asset.manage') then
    raise exception 'asset.manage permission is missing';
  end if;
  if not exists (select 1 from icamp_private.permission_catalog where permission_key = 'equipment.manage') then
    raise exception 'equipment.manage permission is missing';
  end if;
end
$verify$;
