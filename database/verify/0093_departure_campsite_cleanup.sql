-- iCamp Build 073 verification.
do $build073_verify$
declare
  has_programs boolean;
  has_tasks boolean;
  programs_rls boolean;
  tasks_rls boolean;
  checkout_trigger boolean;
  availability_guard boolean;
  direct_delete_grant integer;
begin
  select to_regclass('public.campsite_departure_cleanup_programs') is not null
    into has_programs;
  select to_regclass('public.campsite_departure_cleanup_tasks') is not null
    into has_tasks;

  if not has_programs or not has_tasks then
    raise exception 'Build 073 departure cleanup tables are missing';
  end if;

  select relrowsecurity and relforcerowsecurity
    into programs_rls
  from pg_class
  where oid='public.campsite_departure_cleanup_programs'::regclass;

  select relrowsecurity and relforcerowsecurity
    into tasks_rls
  from pg_class
  where oid='public.campsite_departure_cleanup_tasks'::regclass;

  if not programs_rls or not tasks_rls then
    raise exception 'Build 073 tables must force row level security';
  end if;

  select exists(
    select 1
    from pg_trigger
    where tgrelid='public.reservation_check_outs'::regclass
      and tgname='reservation_check_outs_create_campsite_cleanup'
      and not tgisinternal
  ) into checkout_trigger;

  if not checkout_trigger then
    raise exception 'Build 073 automatic checkout handoff trigger is missing';
  end if;

  select exists(
    select 1
    from pg_trigger
    where tgrelid='public.accommodations'::regclass
      and tgname='accommodations_guard_campsite_cleanup_rebooking'
      and not tgisinternal
  ) into availability_guard;

  if not availability_guard then
    raise exception 'Build 073 rebooking guard trigger is missing';
  end if;

  select count(*)
    into direct_delete_grant
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name in (
      'campsite_departure_cleanup_programs',
      'campsite_departure_cleanup_tasks'
    )
    and grantee='icamp_app'
    and privilege_type='DELETE';

  if direct_delete_grant <> 0 then
    raise exception 'Build 073 tables must not grant DELETE to icamp_app';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.campsite_departure_cleanup_programs'::regclass
      and conname='campsite_departure_cleanup_programs_template_fk'
  ) then
    raise exception 'Build 073 must reuse Build 068 inspection templates';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.campsite_departure_cleanup_tasks'::regclass
      and conname='campsite_departure_cleanup_tasks_occurrence_fk'
  ) then
    raise exception 'Build 073 must reuse Build 068 inspection occurrences';
  end if;
end
$build073_verify$;
