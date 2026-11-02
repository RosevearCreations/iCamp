do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='permanent_unit_finance_owner_evidence_export_acceptances'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Owner evidence export receipt ledger needs forced row-level security';
 end if;
 if has_table_privilege('icamp_app','public.permanent_unit_finance_owner_evidence_export_acceptances','UPDATE,DELETE') then
  raise exception 'Owner export acceptance receipts must remain immutable';
 end if;
 if exists(select 1 from pg_roles where rolname='anon') and
  has_table_privilege('anon','public.permanent_unit_finance_owner_evidence_export_acceptances','SELECT,INSERT,UPDATE,DELETE') then
  raise exception 'Anonymous client must not access owner exports';
 end if;
 if exists(select 1 from pg_roles where rolname='authenticated') and
  has_table_privilege('authenticated','public.permanent_unit_finance_owner_evidence_export_acceptances','SELECT,INSERT,UPDATE,DELETE') then
  raise exception 'Authenticated client must not access owner exports';
 end if;
 if not exists(select 1 from pg_trigger where tgname='finance_owner_evidence_export_immutable' and not tgisinternal) then
  raise exception 'Owner export ledger must have immutable trigger';
 end if;
 if not exists(select 1 from pg_policies where schemaname='public'
  and tablename='permanent_unit_finance_owner_evidence_export_acceptances'
  and policyname='finance_owner_evidence_export_read'
  and qual like '%source_campground_id%' and qual like '%target_campground_id%') then
  raise exception 'Owner evidence export reads must require dual-campground authorization';
 end if;
 if not exists(select 1 from pg_policies where schemaname='public'
  and tablename='permanent_unit_finance_owner_evidence_export_acceptances'
  and policyname='finance_owner_evidence_export_insert'
  and with_check like '%accepted_by_user_id%' and with_check like '%target_campground_id%') then
  raise exception 'Owner evidence export acceptance must verify actor and both properties';
 end if;
 if not exists(select 1 from pg_constraint where conname='finance_owner_evidence_export_distinct_properties') then
  raise exception 'Owner export must select two distinct properties';
 end if;
end $verify$;
