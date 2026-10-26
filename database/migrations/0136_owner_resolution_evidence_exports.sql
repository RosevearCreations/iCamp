-- Build 105: auditable, owner-accepted, bounded evidence CSV export receipts.
-- These receipts attest only to internal planning metadata, not lending or applicant decisions.
create table public.permanent_unit_finance_owner_evidence_export_acceptances (
 id uuid primary key,
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 search_status text not null check(search_status in
  ('all','awaiting_review','revisit_needed','supported_pending_acceptance','accepted')),
 search_query text not null default '' check(char_length(search_query)<=100),
 date_from date,
 date_to date,
 export_row_count integer not null check(export_row_count between 1 and 50),
 export_sha256 text not null check(export_sha256 ~ '^[0-9a-f]{64}$'),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 acceptance_note text not null check(char_length(trim(acceptance_note)) between 12 and 800),
 accepted_by_user_id uuid not null references icamp_private.user_accounts(id),
 accepted_at timestamptz not null default clock_timestamp(),
 constraint finance_owner_evidence_export_distinct_properties check(source_campground_id<>target_campground_id),
 constraint finance_owner_evidence_export_ordered_dates check(date_from is null or date_to is null or date_from<=date_to)
);
create index finance_owner_evidence_export_pair_idx
 on public.permanent_unit_finance_owner_evidence_export_acceptances
 (source_campground_id,target_campground_id,accepted_at desc);

alter table public.permanent_unit_finance_owner_evidence_export_acceptances enable row level security;
alter table public.permanent_unit_finance_owner_evidence_export_acceptances force row level security;
revoke all on public.permanent_unit_finance_owner_evidence_export_acceptances from public;
do $roles$ declare name text; begin
 foreach name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=name) then
   execute format('revoke all on public.permanent_unit_finance_owner_evidence_export_acceptances from %I',name);
  end if;
 end loop;
end $roles$;
grant select,insert on public.permanent_unit_finance_owner_evidence_export_acceptances to icamp_app;

create policy finance_owner_evidence_export_read
 on public.permanent_unit_finance_owner_evidence_export_acceptances
 for select to icamp_app using(
  icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
 );
create policy finance_owner_evidence_export_insert
 on public.permanent_unit_finance_owner_evidence_export_acceptances
 for insert to icamp_app with check(
  icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and accepted_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 );
create trigger finance_owner_evidence_export_immutable
 before update or delete on public.permanent_unit_finance_owner_evidence_export_acceptances
 for each row execute function icamp_private.winterization_append_only();
