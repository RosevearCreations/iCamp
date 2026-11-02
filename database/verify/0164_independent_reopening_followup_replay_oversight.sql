do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_reopening_followup_oversights'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 134 forced RLS missing'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_reopening_followup_oversights','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_reopening_followup_oversights','UPDATE,DELETE') then
  raise exception 'Build 134 audit privileges must be owner-scoped and append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_reopening_followup_oversights'
   and t.tgname='reopening_followup_oversight_guard' and not t.tgisinternal) then
  raise exception 'Build 134 independent reopening evidence guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_reopening_followup_oversights'
   and t.tgname='reopening_followup_oversight_immutable' and not t.tgisinternal) then
  raise exception 'Build 134 audit append-only trigger missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public'
  and tablename='owner_export_reopening_followup_oversights'
  and indexname='reopening_followup_first_idx') then
  raise exception 'Build 134 first follow-up uniqueness missing'; end if;
 if exists(select 1 from information_schema.role_table_grants
   where table_schema='public' and table_name='owner_export_reopening_followup_oversights'
    and grantee in('anon','authenticated','service_role')) then
  raise exception 'Build 134 must not expose owner audit receipts through client roles'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='icamp_private' and c.relname='integration_handshake_receipts'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Integration Contract v1 handshake receipts need forced RLS in the private schema'; end if;
 if not has_table_privilege('icamp_app','icamp_private.integration_handshake_receipts','INSERT')
  or has_table_privilege('icamp_app','icamp_private.integration_handshake_receipts','SELECT,UPDATE,DELETE') then
  raise exception 'Integration v1 receipt privilege must be insert-only'; end if;
 if not exists(select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
  where t.relname='integration_handshake_receipts' and c.contype='u') then
  raise exception 'Integration v1 durable nonce uniqueness missing'; end if;
end $verify$;
