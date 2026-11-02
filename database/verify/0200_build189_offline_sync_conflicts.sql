do $verify_build189$
begin
  if not exists(select 1 from pg_class
    where oid='public.maintenance_offline_sync_conflicts'::regclass
      and relrowsecurity and relforcerowsecurity) then
    raise exception 'Build189 conflict evidence must FORCE RLS';
  end if;
  if has_table_privilege('icamp_app','public.maintenance_offline_sync_conflicts','UPDATE')
    or has_table_privilege('icamp_app','public.maintenance_offline_sync_conflicts','DELETE')
    or (exists(select 1 from pg_roles where rolname='anon') and
      has_table_privilege('anon','public.maintenance_offline_sync_conflicts','SELECT'))
    or (exists(select 1 from pg_roles where rolname='authenticated') and
      has_table_privilege('authenticated','public.maintenance_offline_sync_conflicts','INSERT')) then
    raise exception 'Build189 conflict evidence grants are unsafe';
  end if;
  if not exists(select 1 from pg_trigger where tgname='guard_offline_sync_conflict_immutability'
    and tgrelid='public.maintenance_offline_sync_conflicts'::regclass and not tgisinternal) then
    raise exception 'Build189 immutable conflict trigger missing';
  end if;
  if not exists(select 1 from pg_trigger where tgname='guard_offline_receipt_review'
    and tgrelid='public.maintenance_offline_sync_receipts'::regclass and not tgisinternal) then
    raise exception 'Build189 replay review scope trigger missing';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public'
    and indexname='maintenance_offline_receipts_review_fk_idx') then
    raise exception 'Build189 reviewed conflict FK index missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public'
    and tablename='maintenance_offline_sync_conflicts' and cmd='INSERT'
    and with_check like '%maintenance.offline.media%') then
    raise exception 'Build189 replay RLS permission isolation missing';
  end if;
end $verify_build189$;
