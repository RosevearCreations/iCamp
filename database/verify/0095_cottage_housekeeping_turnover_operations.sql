-- iCamp Build 074 verification.
do $build074_verify$
declare
  evidence_exists boolean;
  evidence_rls boolean;
  release_guard boolean;
  template_guard boolean;
  direct_delete_grant integer;
begin
  select to_regclass('public.cottage_turnover_inspection_evidence') is not null
    into evidence_exists;

  if not evidence_exists then
    raise exception 'Build 074 cottage turnover inspection evidence table is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='cottage_housekeeping_templates'
      and column_name='final_inspection_template_id'
  ) then
    raise exception 'Build 074 final inspection template link is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='cottage_turnovers'
      and column_name='released_at'
  ) then
    raise exception 'Build 074 turnover release evidence is missing';
  end if;

  select relrowsecurity and relforcerowsecurity
    into evidence_rls
  from pg_class
  where oid='public.cottage_turnover_inspection_evidence'::regclass;

  if not evidence_rls then
    raise exception 'Build 074 evidence table must force row level security';
  end if;

  select exists(
    select 1
    from pg_trigger
    where tgrelid='public.accommodations'::regclass
      and tgname='accommodations_guard_cottage_turnover_release'
      and not tgisinternal
  ) into release_guard;

  if not release_guard then
    raise exception 'Build 074 cottage availability release guard is missing';
  end if;

  select exists(
    select 1
    from pg_trigger
    where tgrelid='public.cottage_housekeeping_templates'::regclass
      and tgname='cottage_housekeeping_templates_validate_final_inspection'
      and not tgisinternal
  ) into template_guard;

  if not template_guard then
    raise exception 'Build 074 same-cottage inspection-template guard is missing';
  end if;

  select count(*)
    into direct_delete_grant
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name='cottage_turnover_inspection_evidence'
    and grantee='icamp_app'
    and privilege_type='DELETE';

  if direct_delete_grant <> 0 then
    raise exception 'Build 074 evidence must remain append-only';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.cottage_turnover_inspection_evidence'::regclass
      and conname='cottage_turnover_inspection_evidence_occurrence_fk'
  ) then
    raise exception 'Build 074 must reuse Build 068 inspection occurrences';
  end if;
end
$build074_verify$;
