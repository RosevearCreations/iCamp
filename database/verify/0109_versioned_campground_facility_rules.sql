-- Build 082 structural and permission verification. Run under an operator with catalog access.
do $verify$
declare name text; permission_name text;
begin
 foreach name in array array[
  'campground_rule_sets','campground_rule_versions','campground_rule_acknowledgements'
 ] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=name and c.relrowsecurity and c.relforcerowsecurity) then
    raise exception 'Build 082 table % requires forced RLS',name;
  end if;
  if exists(select 1 from pg_roles where rolname='anon')
    and has_table_privilege('anon','public.'||name,'SELECT') then
    raise exception 'Build 082 % may not be anonymously accessible',name;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated')
    and has_table_privilege('authenticated','public.'||name,'INSERT') then
    raise exception 'Build 082 % may not allow direct authenticated inserts',name;
  end if;
 end loop;
 foreach permission_name in array array['campground.rules.read','campground.rules.publish'] loop
  if not exists(select 1 from icamp_private.permission_catalog where permission_key=permission_name)
   then raise exception 'Missing Build 082 permission %',permission_name; end if;
 end loop;
 if (select count(*) from pg_trigger where not tgisinternal and tgname in (
  'campground_rule_set_immutable','campground_rule_version_immutable',
  'campground_rule_ack_immutable','campground_rule_version_validate','campground_rule_ack_validate'
 ))<>5 then raise exception 'Immutable rules and acknowledgement validators missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public'
  and indexname='campground_rule_versions_current_idx') then
  raise exception 'Current published version lookup index missing';
 end if;
 if not exists(select 1 from pg_constraint
  where conrelid='public.campground_rule_acknowledgements'::regclass
   and contype='u' and pg_get_constraintdef(oid) like '%UNIQUE (rule_version_id, reservation_id)%') then
  raise exception 'Exact-version, reservation-scoped acknowledgement uniqueness missing';
 end if;
end $verify$;
