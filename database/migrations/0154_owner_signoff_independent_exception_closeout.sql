-- Build 124: independently reassess owner sign-off follow-ups and escalation evidence.
-- Audit-ledger closeout never changes operational holds, cases or financial records.
create table public.owner_export_signoff_independent_closeout_reviews (
 id uuid primary key,
 owner_signoff_id uuid not null unique references public.owner_export_closure_audit_owner_signoffs(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check(review_kind in
  ('continue_exception','request_escalation_evidence_refresh','manual_escalation','independent_exception_closed')),
 next_due_at timestamptz,
 observed_signoff_days_overdue integer not null default 0 check(observed_signoff_days_overdue>=0),
 observed_peer_open_signoffs integer not null default 0 check(observed_peer_open_signoffs>=0),
 observed_peer_overdue_signoffs integer not null default 0 check(observed_peer_overdue_signoffs>=0),
 observed_prior_escalation_acceptances integer not null default 0 check(observed_prior_escalation_acceptances>=0),
 observed_prior_evidence_refreshes integer not null default 0 check(observed_prior_evidence_refreshes>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint signoff_closeout_pair check(source_campground_id<>target_campground_id),
 constraint signoff_closeout_due check(
  (review_kind='independent_exception_closed' and next_due_at is null)
  or (review_kind<>'independent_exception_closed' and next_due_at is not null))
);
create index signoff_closeout_pair_idx on public.owner_export_signoff_independent_closeout_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create function icamp_private.signoff_independent_closeout_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare signoff_record record; audit_record record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,124124));
 select * into signoff_record from public.owner_export_closure_audit_owner_signoffs where id=new.owner_signoff_id;
 if signoff_record.id is null or signoff_record.source_campground_id<>new.source_campground_id
  or signoff_record.target_campground_id<>new.target_campground_id then
  raise exception 'Independent closeout requires a matching owner sign-off and ordered campground pair'; end if;
 select * into audit_record from public.owner_export_handoff_independent_closure_audits
  where id=signoff_record.independent_audit_id;
 if new.reviewed_by_user_id=signoff_record.signed_by_user_id
  or new.reviewed_by_user_id=audit_record.audited_by_user_id then
  raise exception 'Independent closeout reviewer must differ from owner signer and prior auditor'; end if;
 new.reviewed_at:=clock_timestamp();
 select count(*) filter(where s.signoff_kind<>'acknowledge_independent_closure')::int,
        count(*) filter(where s.next_due_at<new.reviewed_at)::int,
        count(*) filter(where s.signoff_kind='accept_manual_escalation'
          and s.signed_at>=new.reviewed_at-interval '90 days')::int
 into new.observed_peer_open_signoffs,new.observed_peer_overdue_signoffs,new.observed_prior_escalation_acceptances
 from public.owner_export_closure_audit_owner_signoffs s
 where s.source_campground_id=new.source_campground_id and s.target_campground_id=new.target_campground_id
  and s.id<>signoff_record.id;
 select count(*)::int into new.observed_prior_evidence_refreshes
 from public.owner_export_signoff_independent_closeout_reviews r
 where r.source_campground_id=new.source_campground_id and r.target_campground_id=new.target_campground_id
  and r.review_kind='request_escalation_evidence_refresh'
  and r.reviewed_at>=new.reviewed_at-interval '90 days';
 new.observed_signoff_days_overdue:=case when signoff_record.next_due_at is null then 0
  else greatest(0,floor(extract(epoch from (new.reviewed_at-signoff_record.next_due_at))/86400))::int end;
 if new.review_kind='independent_exception_closed' then
  if signoff_record.signoff_kind<>'acknowledge_independent_closure'
   or audit_record.audit_kind<>'independent_audit_closed' then
   raise exception 'Independent exception closeout requires a previously closed audit and owner acknowledgment'; end if;
  if new.next_due_at is not null then raise exception 'Closed independent review cannot set a new due date'; end if;
  if new.observed_peer_open_signoffs>0 or new.observed_peer_overdue_signoffs>0
   or new.observed_prior_escalation_acceptances>0 or new.observed_prior_evidence_refreshes>0 then
   raise exception 'Independent closeout cannot dismiss peer exceptions or unresolved escalation evidence'; end if;
 else
  if new.next_due_at is null or new.next_due_at<=new.reviewed_at
   or new.next_due_at>new.reviewed_at+interval '90 days' then
   raise exception 'Independent exception follow-up must be due within 90 days'; end if;
  if signoff_record.signoff_kind='acknowledge_independent_closure'
   and new.review_kind='continue_exception' then
   raise exception 'A previously closed audit cannot be passively continued as an exception'; end if;
  if signoff_record.signoff_kind in ('accept_manual_escalation','request_evidence_refresh')
   and new.review_kind='continue_exception' then
   raise exception 'Escalation or evidence refresh cannot be silently continued'; end if;
  if new.observed_signoff_days_overdue>=30 and new.review_kind<>'manual_escalation' then
   raise exception 'Owner sign-offs overdue 30+ days require independent manual escalation'; end if;
  if signoff_record.next_due_at<new.reviewed_at and new.review_kind='continue_exception' then
   raise exception 'Overdue owner sign-offs cannot receive passive continuation'; end if;
  if new.observed_prior_escalation_acceptances>=2 and new.review_kind<>'manual_escalation' then
   raise exception 'Recurring owner escalation acceptances require independent escalation'; end if;
  if new.observed_prior_evidence_refreshes>=2 and new.review_kind='continue_exception' then
   raise exception 'Repeated escalation evidence refresh requires a fresh request or escalation'; end if;
 end if;
 return new;
end $$;
create trigger signoff_independent_closeout_guard before insert on public.owner_export_signoff_independent_closeout_reviews
 for each row execute function icamp_private.signoff_independent_closeout_guard();
create trigger signoff_independent_closeout_immutable before update or delete on public.owner_export_signoff_independent_closeout_reviews
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_signoff_independent_closeout_reviews enable row level security;
alter table public.owner_export_signoff_independent_closeout_reviews force row level security;
revoke all on public.owner_export_signoff_independent_closeout_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_signoff_independent_closeout_reviews from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_signoff_independent_closeout_reviews to icamp_app;
create policy signoff_independent_closeout_read on public.owner_export_signoff_independent_closeout_reviews
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy signoff_independent_closeout_insert on public.owner_export_signoff_independent_closeout_reviews
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.signoff_independent_closeout_guard() from public;
