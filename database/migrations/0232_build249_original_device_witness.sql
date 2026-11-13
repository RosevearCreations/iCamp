-- iCamp Build 249: original-device witness admission after independent signature
-- verification. This append-only campground source observation is NOT device
-- owner acceptance and grants no authority to a Master or client.
create table public.service_fulfillment_original_device_witness_admissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null,
  signature_verification_id uuid not null
    references public.service_fulfillment_device_signature_verifications(id),
  original_review_id uuid not null
    references public.service_fulfillment_original_device_review_events(id),
  source_revision text not null check (source_revision ~ '^[0-9a-f]{40}$'),
  decision text not null check (decision in
    ('source_observed_pending_external_authority','discrepancy_hold')),
  explanation text not null check (char_length(trim(explanation)) between 12 and 300),
  admitted_by_user_id uuid not null references icamp_private.user_accounts(id),
  admitted_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id,dispatch_id)
    references public.service_fulfillment_dispatches(organization_id,campground_id,id)
    on delete restrict,
  unique(signature_verification_id)
);
create index service_fulfillment_original_device_witness_recent_idx
  on public.service_fulfillment_original_device_witness_admissions
  (campground_id,admitted_at desc,id desc);

create function icamp_private.guard_original_device_witness_admission()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  signature_row record;
  latest_signature uuid;
  current_review record;
  latest_report record;
  latest_witness record;
begin
  if new.admitted_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Current campground independent supervisor required';
  end if;
  if current_setting('icamp.source_revision',true) is distinct from new.source_revision then
    raise exception 'Deployed source revision required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.signature_verification_id::text),
    pg_catalog.hashtext('icamp-original-device-witness'));
  select organization_id,campground_id,dispatch_id,original_review_id,
    source_revision,verified_by_user_id,verified_at into signature_row
    from public.service_fulfillment_device_signature_verifications
    where id=new.signature_verification_id
      and organization_id=new.organization_id
      and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id;
  select id into latest_signature
    from public.service_fulfillment_device_signature_verifications
    where organization_id=new.organization_id
      and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by verified_at desc,id desc limit 1;
  select id,field_report_id,witness_id,reviewed_by_user_id
    into current_review
    from public.service_fulfillment_original_device_review_events
    where organization_id=new.organization_id
      and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by reviewed_at desc,id desc limit 1;
  select id,reported_by_user_id into latest_report
    from public.service_fulfillment_mobile_field_reports
    where organization_id=new.organization_id
      and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by reported_at desc,id desc limit 1;
  select id,witnessed_by_user_id into latest_witness
    from public.service_fulfillment_field_witness_events
    where organization_id=new.organization_id
      and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by witnessed_at desc,id desc limit 1;
  if signature_row.verified_by_user_id is null
    or signature_row.source_revision is distinct from new.source_revision
    or signature_row.original_review_id is distinct from new.original_review_id
    or latest_signature is distinct from new.signature_verification_id
    or current_review.id is distinct from new.original_review_id
    or current_review.field_report_id is distinct from latest_report.id
    or current_review.witness_id is distinct from latest_witness.id
    or signature_row.verified_at < statement_timestamp()-interval '24 hours'
    or new.admitted_by_user_id in (
      signature_row.verified_by_user_id,
      current_review.reviewed_by_user_id,
      latest_report.reported_by_user_id,
      latest_witness.witnessed_by_user_id
    ) then
    raise exception 'Fresh distinct original-device source witness required';
  end if;
  new.admitted_at:=statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_original_device_witness_guard
before insert on public.service_fulfillment_original_device_witness_admissions
for each row execute function icamp_private.guard_original_device_witness_admission();

alter table public.service_fulfillment_original_device_witness_admissions
  enable row level security;
alter table public.service_fulfillment_original_device_witness_admissions
  force row level security;
revoke all on public.service_fulfillment_original_device_witness_admissions from public;
do $revoke$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.service_fulfillment_original_device_witness_admissions from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.service_fulfillment_original_device_witness_admissions from authenticated;
  end if;
end $revoke$;
grant select,insert on public.service_fulfillment_original_device_witness_admissions to icamp_app;
create policy service_fulfillment_original_device_witness_read
  on public.service_fulfillment_original_device_witness_admissions
  for select to icamp_app
  using (icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_original_device_witness_insert
  on public.service_fulfillment_original_device_witness_admissions
  for insert to icamp_app
  with check (
    admitted_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify')
  );
