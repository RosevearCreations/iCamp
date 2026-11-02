do $verify_build190$
declare t text;
begin
 foreach t in array array['staff_shift_availability','staff_shift_qualification_events',
  'staff_shift_assignments','staff_shift_handoffs','staff_shift_events'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=t and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Build190 % must enable and FORCE RLS',t;
  end if;
  if has_table_privilege('icamp_app',format('icamp_private.%I',t),'UPDATE')
    or has_table_privilege('icamp_app',format('icamp_private.%I',t),'DELETE')
    or (exists(select 1 from pg_roles where rolname='anon')
      and has_table_privilege('anon',format('icamp_private.%I',t),'SELECT'))
    or (exists(select 1 from pg_roles where rolname='authenticated')
      and has_table_privilege('authenticated',format('icamp_private.%I',t),'INSERT')) then
    raise exception 'Build190 private evidence grants are unsafe: %',t;
  end if;
  if not exists(select 1 from pg_trigger tr join pg_class c on c.oid=tr.tgrelid
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=t
    and tr.tgname=t||'_immutable' and not tr.tgisinternal) then
    raise exception 'Build190 immutable trigger missing: %',t;
  end if;
 end loop;
 if not exists(select 1 from icamp_private.permission_catalog where permission_key='staff.shift.self') then
  raise exception 'Build190 self-service staffing permission missing'; end if;
 if not exists(select 1 from pg_trigger where tgname='staff_shift_assignment_guard'
   and tgrelid='icamp_private.staff_shift_assignments'::regclass and not tgisinternal) then
  raise exception 'Build190 qualification/overlap database guard missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='icamp_private'
   and indexname='staff_shift_events_scope_handoff_fk_idx') then
  raise exception 'Build190 handoff scope FK covering index missing'; end if;
 if not exists(select 1 from pg_policies where schemaname='icamp_private'
   and tablename='staff_shift_assignments' and cmd='INSERT'
   and with_check like '%schedule.manage%') then
  raise exception 'Build190 manager-only scheduling policy missing'; end if;
 if not exists(select 1 from pg_policies where schemaname='icamp_private'
   and tablename='staff_shift_qualification_events' and cmd='INSERT'
   and with_check like '%staff.manage%') then
  raise exception 'Build190 independent qualification policy missing'; end if;
end $verify_build190$;
