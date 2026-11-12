-- Build 245: independent human field witness, immutable eight-hour forecast
-- checkpoints and explicit owner audits. None is a cryptographic device receipt.
create table public.service_fulfillment_field_witness_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null,
  closure_id uuid not null references public.service_fulfillment_field_closure_events(id),
  previous_witness_id uuid references public.service_fulfillment_field_witness_events(id),
  decision text not null check (decision in ('observed_unverified','recheck_required')),
  evidence_reference text not null check (evidence_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{4,95}$'),
  explanation text not null check (char_length(trim(explanation)) between 8 and 300),
  witnessed_by_user_id uuid not null references icamp_private.user_accounts(id),
  witnessed_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id,dispatch_id)
    references public.service_fulfillment_dispatches(organization_id,campground_id,id) on delete restrict,
  unique (dispatch_id,previous_witness_id)
);
create unique index service_fulfillment_witness_first_idx
  on public.service_fulfillment_field_witness_events(dispatch_id)
  where previous_witness_id is null;
create index service_fulfillment_witness_latest_idx
  on public.service_fulfillment_field_witness_events
  (campground_id,dispatch_id,witnessed_at desc,id desc);

create function icamp_private.guard_service_fulfillment_field_witness()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  current_closure record;
  current_report uuid;
  previous uuid;
begin
  if new.witnessed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Authorized campground witness required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.dispatch_id::text),pg_catalog.hashtext('icamp-field-witness'));
  select id into previous from public.service_fulfillment_field_witness_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by witnessed_at desc,id desc limit 1;
  if new.previous_witness_id is distinct from previous then
    raise exception 'Witness history changed; refresh the source case';
  end if;
  select c.id,c.decision,c.field_report_id,c.recorded_by_user_id,
         m.reported_by_user_id,s.reviewed_by_user_id
    into current_closure
    from public.service_fulfillment_field_closure_events c
    join public.service_fulfillment_mobile_field_reports m
      on m.id=c.field_report_id and m.organization_id=c.organization_id
      and m.campground_id=c.campground_id and m.dispatch_id=c.dispatch_id
    join public.service_fulfillment_supervisor_review_events s
      on s.id=c.review_id and s.organization_id=c.organization_id
      and s.campground_id=c.campground_id and s.dispatch_id=c.dispatch_id
    where c.organization_id=new.organization_id and c.campground_id=new.campground_id
      and c.dispatch_id=new.dispatch_id
    order by c.recorded_at desc,c.id desc limit 1;
  select id into current_report from public.service_fulfillment_mobile_field_reports
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id order by reported_at desc,id desc limit 1;
  if current_closure.id is distinct from new.closure_id
    or current_report is distinct from current_closure.field_report_id
    or new.witnessed_by_user_id in (
      current_closure.reported_by_user_id,
      current_closure.reviewed_by_user_id,
      current_closure.recorded_by_user_id
    )
    or (new.decision='observed_unverified' and current_closure.decision <> 'closure_reviewed') then
    raise exception 'A distinct witness and current source closure are required';
  end if;
  new.witnessed_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_witness_guard
before insert on public.service_fulfillment_field_witness_events
for each row execute function icamp_private.guard_service_fulfillment_field_witness();

create table public.service_fulfillment_forecast_checkpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  expected_new_review_events integer not null check (expected_new_review_events between 0 and 100000),
  planning_load integer not null check (planning_load between 0 and 100000),
  evidence_coverage text not null check (evidence_coverage in ('PARTIAL_HOLD','SOURCE_SNAPSHOT_ONLY')),
  captured_by_user_id uuid not null references icamp_private.user_accounts(id),
  captured_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict
);
create index service_fulfillment_forecast_checkpoint_idx
  on public.service_fulfillment_forecast_checkpoints
  (campground_id,captured_at desc,id desc);
create function icamp_private.guard_service_fulfillment_forecast_checkpoint()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.captured_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Authorized campground supervisor required for checkpoint';
  end if;
  new.captured_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_forecast_checkpoint_guard
before insert on public.service_fulfillment_forecast_checkpoints
for each row execute function icamp_private.guard_service_fulfillment_forecast_checkpoint();

create function icamp_private.has_current_campground_owner_admin(p_campground uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from icamp_private.campground_assignments a
    join icamp_private.campground_assignment_roles ar on ar.assignment_id=a.id
    join icamp_private.roles r on r.id=ar.role_id and r.lifecycle_state='active'
    where a.campground_id=p_campground
      and a.user_id=icamp_private.request_user_id()
      and a.assignment_state='active'
      and a.starts_at<=statement_timestamp()
      and (a.ends_at is null or a.ends_at>statement_timestamp())
      and r.role_code='owner_admin'
  )
$$;
revoke all on function icamp_private.has_current_campground_owner_admin(uuid) from public;
grant execute on function icamp_private.has_current_campground_owner_admin(uuid) to icamp_app;

create table public.service_fulfillment_owner_shift_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  subject_kind text not null check (subject_kind in ('field_witness','forecast_checkpoint')),
  subject_id uuid not null,
  decision text not null check (decision in ('reviewed_unverified','recheck_required')),
  explanation text not null check (char_length(trim(explanation)) between 8 and 300),
  reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
  reviewed_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  unique (campground_id,subject_kind,subject_id)
);
create index service_fulfillment_owner_shift_audit_recent_idx
  on public.service_fulfillment_owner_shift_audit_events(campground_id,reviewed_at desc,id desc);

create function icamp_private.guard_service_fulfillment_owner_shift_audit()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  witness record;
  forecast record;
begin
  if new.reviewed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_current_campground_owner_admin(new.campground_id)
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Active campground Owner / Administrator required';
  end if;
  if new.subject_kind='field_witness' then
    select id,dispatch_id,witnessed_by_user_id into witness
      from public.service_fulfillment_field_witness_events
      where organization_id=new.organization_id and campground_id=new.campground_id
        and id=new.subject_id;
    if witness.id is null or witness.witnessed_by_user_id=new.reviewed_by_user_id
      or exists (
        select 1 from public.service_fulfillment_field_witness_events w
        where w.organization_id=new.organization_id and w.campground_id=new.campground_id
          and w.dispatch_id=witness.dispatch_id and w.id<>witness.id
          and (w.witnessed_at,w.id)>(
            select w2.witnessed_at,w2.id from public.service_fulfillment_field_witness_events w2
            where w2.id=witness.id
          )
      ) then
      raise exception 'An independent, latest witness event is required';
    end if;
  else
    select id,captured_at into forecast from public.service_fulfillment_forecast_checkpoints
      where organization_id=new.organization_id and campground_id=new.campground_id
        and id=new.subject_id;
    if forecast.id is null or forecast.captured_at+interval '8 hours'>statement_timestamp() then
      raise exception 'Forecast horizon must complete before owner review';
    end if;
  end if;
  new.reviewed_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_owner_shift_audit_guard
before insert on public.service_fulfillment_owner_shift_audit_events
for each row execute function icamp_private.guard_service_fulfillment_owner_shift_audit();

do $roles$ declare t text; begin
  foreach t in array array[
    'service_fulfillment_field_witness_events',
    'service_fulfillment_forecast_checkpoints',
    'service_fulfillment_owner_shift_audit_events'
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
create policy service_fulfillment_field_witness_read
  on public.service_fulfillment_field_witness_events for select to icamp_app
  using (icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_field_witness_insert
  on public.service_fulfillment_field_witness_events for insert to icamp_app
  with check (witnessed_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_forecast_checkpoint_read
  on public.service_fulfillment_forecast_checkpoints for select to icamp_app
  using (icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_forecast_checkpoint_insert
  on public.service_fulfillment_forecast_checkpoints for insert to icamp_app
  with check (captured_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_owner_shift_audit_read
  on public.service_fulfillment_owner_shift_audit_events for select to icamp_app
  using (icamp_private.has_current_campground_owner_admin(campground_id));
create policy service_fulfillment_owner_shift_audit_insert
  on public.service_fulfillment_owner_shift_audit_events for insert to icamp_app
  with check (reviewed_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_current_campground_owner_admin(campground_id));
