-- iCamp Build 246. Private source evidence only. Digest and a human review
-- never confer original-device signature, signer enrollment or Master acceptance.
create table public.service_fulfillment_original_device_review_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null,
  field_report_id uuid not null references public.service_fulfillment_mobile_field_reports(id),
  witness_id uuid not null references public.service_fulfillment_field_witness_events(id),
  previous_review_id uuid references public.service_fulfillment_original_device_review_events(id),
  evidence_reference text not null check(evidence_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{4,95}$'),
  digest_sha256 text not null check(digest_sha256 ~ '^[0-9a-f]{64}$'),
  decision text not null check(decision in ('inspected_unverified','recheck_required')),
  explanation text not null check(char_length(trim(explanation)) between 8 and 300),
  reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
  reviewed_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id,dispatch_id)
    references public.service_fulfillment_dispatches(organization_id,campground_id,id) on delete restrict,
  unique (dispatch_id,previous_review_id)
);
create unique index service_fulfillment_device_review_first_idx
  on public.service_fulfillment_original_device_review_events(dispatch_id)
  where previous_review_id is null;
create index service_fulfillment_device_review_recent_idx
  on public.service_fulfillment_original_device_review_events(campground_id,dispatch_id,reviewed_at desc,id desc);

create function icamp_private.guard_service_fulfillment_original_device_review()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  latest_id uuid;
  report record;
  witness record;
  closure record;
begin
  if new.reviewed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Current campground supervisor access required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.dispatch_id::text),pg_catalog.hashtext('icamp-original-device-review'));
  select id into latest_id from public.service_fulfillment_original_device_review_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by reviewed_at desc,id desc limit 1;
  if latest_id is distinct from new.previous_review_id then
    raise exception 'Original-device review history changed; refresh';
  end if;
  select id,reported_by_user_id,outcome into report
    from public.service_fulfillment_mobile_field_reports
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by reported_at desc,id desc limit 1;
  select id,closure_id,witnessed_by_user_id,decision into witness
    from public.service_fulfillment_field_witness_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by witnessed_at desc,id desc limit 1;
  select id,field_report_id,recorded_by_user_id,decision into closure
    from public.service_fulfillment_field_closure_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by recorded_at desc,id desc limit 1;
  if report.id is null or report.id is distinct from new.field_report_id
    or witness.id is null or witness.id is distinct from new.witness_id
    or witness.closure_id is distinct from closure.id
    or closure.field_report_id is distinct from report.id
    or new.reviewed_by_user_id in (
      report.reported_by_user_id,witness.witnessed_by_user_id,closure.recorded_by_user_id
    )
    or (new.decision='inspected_unverified' and (
      report.outcome<>'usable' or witness.decision<>'observed_unverified'
      or closure.decision<>'closure_reviewed'
    )) then
    raise exception 'Current independently authored source evidence required';
  end if;
  new.reviewed_at:=statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_original_device_review_guard
before insert on public.service_fulfillment_original_device_review_events
for each row execute function icamp_private.guard_service_fulfillment_original_device_review();

create table public.service_fulfillment_calibration_followup_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  checkpoint_id uuid not null references public.service_fulfillment_forecast_checkpoints(id),
  previous_event_id uuid references public.service_fulfillment_calibration_followup_events(id),
  expected_new_review_events integer not null check(expected_new_review_events>=0),
  observed_new_review_events integer not null check(observed_new_review_events>=0),
  absolute_error integer not null check(absolute_error>=0),
  decision text not null check(decision in ('investigate','mitigation_recorded','recheck_required')),
  explanation text not null check(char_length(trim(explanation)) between 8 and 300),
  recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  unique (checkpoint_id,previous_event_id)
);
create unique index service_fulfillment_calibration_first_idx
  on public.service_fulfillment_calibration_followup_events(checkpoint_id)
  where previous_event_id is null;
create index service_fulfillment_calibration_recent_idx
  on public.service_fulfillment_calibration_followup_events(campground_id,checkpoint_id,recorded_at desc,id desc);

create function icamp_private.guard_service_fulfillment_calibration_followup()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  checkpoint record;
  previous uuid;
  observed integer;
begin
  if new.recorded_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Current campground supervisor access required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.checkpoint_id::text),pg_catalog.hashtext('icamp-calibration'));
  select * into checkpoint from public.service_fulfillment_forecast_checkpoints
    where id=new.checkpoint_id and campground_id=new.campground_id
      and organization_id=new.organization_id;
  if checkpoint.id is null or checkpoint.captured_at+interval '8 hours'>statement_timestamp()
    or checkpoint.evidence_coverage<>'SOURCE_SNAPSHOT_ONLY' then
    raise exception 'Completed full-source checkpoint required';
  end if;
  select id into previous from public.service_fulfillment_calibration_followup_events
    where checkpoint_id=new.checkpoint_id and campground_id=new.campground_id
      and organization_id=new.organization_id
    order by recorded_at desc,id desc limit 1;
  if previous is distinct from new.previous_event_id then
    raise exception 'Calibration history changed; refresh the checkpoint';
  end if;
  select count(*) into observed from (
    select id from public.service_fulfillment_supervisor_review_events e
      where e.campground_id=new.campground_id and e.organization_id=new.organization_id
        and e.reviewed_at>=checkpoint.captured_at
        and e.reviewed_at<checkpoint.captured_at+interval '8 hours'
        and e.decision in ('escalation_requested','blocker_escalated')
    union all
    select id from public.service_fulfillment_shift_handoff_events h
      where h.campground_id=new.campground_id and h.organization_id=new.organization_id
        and h.recorded_at>=checkpoint.captured_at
        and h.recorded_at<checkpoint.captured_at+interval '8 hours'
        and h.event_kind='request'
  ) matching_events;
  if new.expected_new_review_events<>checkpoint.expected_new_review_events
    or new.observed_new_review_events<>observed
    or new.absolute_error<>abs(observed-checkpoint.expected_new_review_events) then
    raise exception 'Forecast evidence mismatch; recompute from original source';
  end if;
  new.recorded_at:=statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_calibration_followup_guard
before insert on public.service_fulfillment_calibration_followup_events
for each row execute function icamp_private.guard_service_fulfillment_calibration_followup();

do $roles$ declare t text; begin
  foreach t in array array[
    'service_fulfillment_original_device_review_events',
    'service_fulfillment_calibration_followup_events'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from public',t);
    if exists(select 1 from pg_roles where rolname='anon') then
      execute format('revoke all on public.%I from anon',t);
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') then
      execute format('revoke all on public.%I from authenticated',t);
    end if;
    execute format('grant select,insert on public.%I to icamp_app',t);
  end loop;
end $roles$;
create policy service_fulfillment_original_device_review_read
  on public.service_fulfillment_original_device_review_events for select to icamp_app
  using (icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_original_device_review_insert
  on public.service_fulfillment_original_device_review_events for insert to icamp_app
  with check (reviewed_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_calibration_followup_read
  on public.service_fulfillment_calibration_followup_events for select to icamp_app
  using (icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_calibration_followup_insert
  on public.service_fulfillment_calibration_followup_events for insert to icamp_app
  with check (recorded_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
