-- iCamp Build 059 verification.
do $verify$
declare
  requests_force_rls boolean;
  outcomes_force_rls boolean;
begin
  if to_regclass('public.gate_override_requests') is null then
    raise exception 'gate_override_requests table is missing';
  end if;
  if to_regclass('public.gate_override_outcomes') is null then
    raise exception 'gate_override_outcomes table is missing';
  end if;

  select c.relforcerowsecurity into requests_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='gate_override_requests';

  select c.relforcerowsecurity into outcomes_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='gate_override_outcomes';

  if requests_force_rls is distinct from true
    or outcomes_force_rls is distinct from true then
    raise exception 'Build 059 evidence tables must FORCE RLS';
  end if;

  if has_table_privilege('icamp_app','public.gate_override_requests','INSERT')
    or has_table_privilege('icamp_app','public.gate_override_requests','UPDATE')
    or has_table_privilege('icamp_app','public.gate_override_requests','DELETE')
    or has_table_privilege('icamp_app','public.gate_override_outcomes','INSERT')
    or has_table_privilege('icamp_app','public.gate_override_outcomes','UPDATE')
    or has_table_privilege('icamp_app','public.gate_override_outcomes','DELETE') then
    raise exception 'Build 059 command writes must remain server-only and evidence append-only';
  end if;

  if not exists (
    select 1 from icamp_private.permission_catalog
    where permission_key='gate.override.open'
      and risk_level='high'
  ) then
    raise exception 'gate.override.open must remain a high-risk permission';
  end if;

  if not exists (
    select 1 from icamp_private.permission_catalog
    where permission_key='gate.override.close'
      and risk_level='high'
  ) then
    raise exception 'gate.override.close must remain a high-risk permission';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='gate_override_requests_validate'
      and not tgisinternal
  ) then
    raise exception 'Build 059 request validation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='gate_override_requests'
      and indexname='gate_override_requests_scope_device_fk_idx'
  ) then
    raise exception 'Build 059 request device FK index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='gate_override_outcomes'
      and indexname='gate_override_outcomes_scope_request_fk_idx'
  ) then
    raise exception 'Build 059 outcome request FK index is missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.gate_override_requests','SELECT')
      or has_table_privilege('anon','public.gate_override_outcomes','SELECT') then
      raise exception 'anon direct Build 059 evidence access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.gate_override_requests','SELECT')
      or has_table_privilege('authenticated','public.gate_override_outcomes','SELECT') then
      raise exception 'authenticated direct Build 059 evidence access must remain denied';
    end if;
  end if;
end
$verify$;
