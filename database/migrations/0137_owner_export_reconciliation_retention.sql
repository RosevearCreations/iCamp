-- Build 106: evidence export reconciliation and manual copy retention / disposal attestations.
-- The immutable export acceptance receipt is never edited or purged.
create table public.permanent_unit_finance_owner_export_reconciliations (
 id uuid primary key,
 export_acceptance_id uuid not null references public.permanent_unit_finance_owner_evidence_export_acceptances(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 observed_sha256 text not null check(observed_sha256 ~ '^[0-9a-f]{64}$'),
 observed_row_count integer not null check(observed_row_count between 1 and 50),
 result text not null check(result in ('matched','mismatch')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 reconciliation_note text not null check(char_length(trim(reconciliation_note)) between 12 and 800),
 reconciled_by_user_id uuid not null references icamp_private.user_accounts(id),
 reconciled_at timestamptz not null default clock_timestamp()
);
create index finance_owner_export_recon_receipt_idx
 on public.permanent_unit_finance_owner_export_reconciliations(export_acceptance_id,reconciled_at desc,id desc);
create unique index finance_owner_export_one_match_idx
 on public.permanent_unit_finance_owner_export_reconciliations(export_acceptance_id) where result='matched';

create table public.permanent_unit_finance_owner_export_retention_events (
 id uuid primary key,
 export_acceptance_id uuid not null references public.permanent_unit_finance_owner_evidence_export_acceptances(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 event_kind text not null check(event_kind in ('retained','extended','copy_disposed')),
 retention_due_at timestamptz,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 retention_note text not null check(char_length(trim(retention_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint finance_owner_export_retention_due_kind check(
   (event_kind='copy_disposed' and retention_due_at is null)
   or (event_kind in ('retained','extended') and retention_due_at is not null))
);
create index finance_owner_export_retention_receipt_idx
 on public.permanent_unit_finance_owner_export_retention_events(export_acceptance_id,recorded_at desc,id desc);
create unique index finance_owner_export_one_disposal_idx
 on public.permanent_unit_finance_owner_export_retention_events(export_acceptance_id) where event_kind='copy_disposed';

create function icamp_private.finance_owner_export_reconciliation_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare receipt record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.export_acceptance_id::text,106106));
 select * into receipt from public.permanent_unit_finance_owner_evidence_export_acceptances
  where id=new.export_acceptance_id;
 if receipt.id is null or receipt.source_campground_id<>new.source_campground_id
  or receipt.target_campground_id<>new.target_campground_id
  or receipt.accepted_by_user_id=new.reconciled_by_user_id
  or exists(select 1 from public.permanent_unit_finance_owner_export_reconciliations
    where export_acceptance_id=new.export_acceptance_id and result='matched') then
  raise exception 'A separate owner must reconcile this export receipt before final matching';
 end if;
 if (new.observed_sha256=receipt.export_sha256 and new.observed_row_count=receipt.export_row_count)
    <> (new.result='matched') then
  raise exception 'Reconciliation result does not reflect the original accepted hash and row count';
 end if;
 return new;
end $$;
create trigger finance_owner_export_reconciliation_guard
 before insert on public.permanent_unit_finance_owner_export_reconciliations
 for each row execute function icamp_private.finance_owner_export_reconciliation_guard();

create function icamp_private.finance_owner_export_retention_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare receipt record; recent record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.export_acceptance_id::text,106106));
 select * into receipt from public.permanent_unit_finance_owner_evidence_export_acceptances
  where id=new.export_acceptance_id;
 select * into recent from public.permanent_unit_finance_owner_export_retention_events
  where export_acceptance_id=new.export_acceptance_id order by recorded_at desc,id desc limit 1;
 if receipt.id is null or receipt.source_campground_id<>new.source_campground_id
  or receipt.target_campground_id<>new.target_campground_id
  or not exists(select 1 from public.permanent_unit_finance_owner_export_reconciliations
   where export_acceptance_id=new.export_acceptance_id and result='matched')
  or recent.event_kind='copy_disposed' then
  raise exception 'Copy retention requires a matched independent reconciliation and an active receipt';
 end if;
 if new.event_kind='retained' then
  if recent.id is not null then raise exception 'Initial storage attestation already exists'; end if;
 elsif new.event_kind in ('extended','copy_disposed') then
  if recent.id is null or recent.event_kind not in ('retained','extended') then
   raise exception 'A prior retained copy attestation is required';
  end if;
 end if;
 if new.event_kind='copy_disposed' then
  if new.retention_due_at is not null then raise exception 'Disposal cannot keep an active retention date'; end if;
 elsif new.retention_due_at is null or new.retention_due_at<=clock_timestamp()
   or new.retention_due_at>clock_timestamp()+interval '180 days' then
  raise exception 'Copy retention deadline must be within the next 180 days';
 end if;
 return new;
end $$;
create trigger finance_owner_export_retention_guard
 before insert on public.permanent_unit_finance_owner_export_retention_events
 for each row execute function icamp_private.finance_owner_export_retention_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_owner_export_reconciliations','permanent_unit_finance_owner_export_retention_events'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public',tab);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then
    execute format('revoke all on public.%I from %I',tab,role_name);
   end if;
  end loop;
  execute format('grant select,insert on public.%I to icamp_app',tab);
  execute format('create trigger %I before update or delete on public.%I for each row execute function icamp_private.winterization_append_only()',tab||'_immutable',tab);
  execute format('create policy %I on public.%I for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id))',tab||'_read',tab);
 end loop;
end $roles$;
create policy finance_owner_export_reconciliation_insert on public.permanent_unit_finance_owner_export_reconciliations
 for insert to icamp_app with check(
  icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reconciled_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy finance_owner_export_retention_insert on public.permanent_unit_finance_owner_export_retention_events
 for insert to icamp_app with check(
  icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.finance_owner_export_reconciliation_guard() from public;
revoke all on function icamp_private.finance_owner_export_retention_guard() from public;
