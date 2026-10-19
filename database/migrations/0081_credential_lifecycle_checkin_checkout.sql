-- iCamp Build 062
-- Credential Lifecycle at Check-In/Check-Out.
--
-- The active delivery queue advances the next non-duplicative roadmap scope
-- after Build 061: reservation credential provisioning, stay-synchronized
-- validity, checkout/cancellation revocation and lost/replacement lifecycle.

alter table public.access_credential_events
  drop constraint if exists access_credential_events_event_kind_check;

alter table public.access_credential_events
  add constraint access_credential_events_event_kind_check
  check (
    event_kind in (
      'issued',
      'revoked',
      'expired_observed',
      'provider_linked',
      'validity_extended',
      'validity_shortened',
      'lost',
      'replaced'
    )
  );

create table public.campground_credential_lifecycle_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  checkout_local_time time not null default '11:00',
  grace_minutes smallint not null default 0
    check (grace_minutes between 0 and 180),
  updated_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_credential_lifecycle_policy_scope_unique
    unique (organization_id,campground_id),
  constraint campground_credential_lifecycle_policy_campground_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade
    on delete restrict
);

create index campground_credential_lifecycle_policy_updated_by_idx
  on public.campground_credential_lifecycle_policies(updated_by_user_id);

create trigger campground_credential_lifecycle_policy_touch
before update on public.campground_credential_lifecycle_policies
for each row execute function icamp_private.touch_row();

create table public.reservation_access_credential_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  check_in_id uuid not null,
  credential_id uuid not null,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active','revoked','replaced')),
  sync_with_stay boolean not null default true,
  replacement_for_assignment_id uuid,
  source_channel text not null default 'staff'
    check (source_channel in ('web','staff','ivr','sms','system')),
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 8 and 200),
  provisioned_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  provisioned_at timestamptz not null default statement_timestamp(),
  ended_at timestamptz,
  ended_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  end_reason text
    check (
      end_reason is null
      or char_length(trim(end_reason)) between 3 and 500
    ),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint reservation_access_credential_assignments_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint reservation_access_credential_assignments_credential_unique
    unique (organization_id,campground_id,credential_id),
  constraint reservation_access_credential_assignments_idempotency_unique
    unique (campground_id,idempotency_key),
  constraint reservation_access_credential_assignments_replacement_unique
    unique (replacement_for_assignment_id),
  constraint reservation_access_credential_assignments_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_access_credential_assignments_check_in_fk
    foreign key (organization_id,campground_id,check_in_id)
    references public.reservation_check_ins(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_access_credential_assignments_credential_fk
    foreign key (organization_id,campground_id,credential_id)
    references public.access_credentials(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_access_credential_assignments_replacement_fk
    foreign key (organization_id,campground_id,replacement_for_assignment_id)
    references public.reservation_access_credential_assignments(
      organization_id,campground_id,id
    )
    on update cascade
    on delete restrict,
  constraint reservation_access_credential_assignments_state_shape_check
    check (
      (
        lifecycle_state='active'
        and ended_at is null
        and ended_by_user_id is null
        and end_reason is null
      )
      or
      (
        lifecycle_state in ('revoked','replaced')
        and ended_at is not null
        and end_reason is not null
      )
    )
);

create index reservation_access_credential_assignments_reservation_idx
  on public.reservation_access_credential_assignments(
    organization_id,campground_id,reservation_id,lifecycle_state
  );

create index reservation_access_credential_assignments_check_in_idx
  on public.reservation_access_credential_assignments(
    organization_id,campground_id,check_in_id
  );

create index reservation_access_credential_assignments_replacement_idx
  on public.reservation_access_credential_assignments(
    organization_id,campground_id,replacement_for_assignment_id
  )
  where replacement_for_assignment_id is not null;

create index reservation_access_credential_assignments_provisioned_by_idx
  on public.reservation_access_credential_assignments(provisioned_by_user_id);

create index reservation_access_credential_assignments_ended_by_idx
  on public.reservation_access_credential_assignments(ended_by_user_id)
  where ended_by_user_id is not null;

create or replace function icamp_private.validate_reservation_access_credential_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reservation_row record;
  check_in_row record;
  credential_row record;
  replaced_row record;
begin
  select r.status
    into reservation_row
  from public.reservations r
  where r.organization_id=new.organization_id
    and r.campground_id=new.campground_id
    and r.id=new.reservation_id;

  if not found then
    raise exception 'Credential lifecycle assignment requires a reservation in the same campground scope';
  end if;

  select ci.reservation_id
    into check_in_row
  from public.reservation_check_ins ci
  where ci.organization_id=new.organization_id
    and ci.campground_id=new.campground_id
    and ci.id=new.check_in_id;

  if not found or check_in_row.reservation_id <> new.reservation_id then
    raise exception 'Credential lifecycle assignment requires the reservation check-in';
  end if;

  select c.subject_kind,c.subject_reference_id,c.status,c.valid_until
    into credential_row
  from public.access_credentials c
  where c.organization_id=new.organization_id
    and c.campground_id=new.campground_id
    and c.id=new.credential_id;

  if not found then
    raise exception 'Credential lifecycle assignment requires a credential in the same campground scope';
  end if;

  if credential_row.subject_kind <> 'reservation'
     or credential_row.subject_reference_id is distinct from new.reservation_id then
    raise exception 'Reservation lifecycle credentials must use the reservation as their canonical subject';
  end if;

  if new.lifecycle_state='active' and credential_row.status <> 'active' then
    raise exception 'Active lifecycle assignments require an active access credential';
  end if;

  if new.sync_with_stay and credential_row.valid_until is null then
    raise exception 'Stay-synchronized credentials require bounded validity';
  end if;

  if new.replacement_for_assignment_id is not null then
    select a.reservation_id,a.id
      into replaced_row
    from public.reservation_access_credential_assignments a
    where a.organization_id=new.organization_id
      and a.campground_id=new.campground_id
      and a.id=new.replacement_for_assignment_id;

    if not found
       or replaced_row.reservation_id <> new.reservation_id
       or replaced_row.id = new.id then
      raise exception 'Replacement credential must replace an assignment from the same reservation';
    end if;
  end if;

  if tg_op='UPDATE' then
    if old.organization_id is distinct from new.organization_id
      or old.campground_id is distinct from new.campground_id
      or old.reservation_id is distinct from new.reservation_id
      or old.check_in_id is distinct from new.check_in_id
      or old.credential_id is distinct from new.credential_id
      or old.replacement_for_assignment_id is distinct from new.replacement_for_assignment_id
      or old.idempotency_key is distinct from new.idempotency_key
      or old.provisioned_by_user_id is distinct from new.provisioned_by_user_id
      or old.provisioned_at is distinct from new.provisioned_at then
      raise exception 'Credential lifecycle assignment identity is immutable';
    end if;

    if old.lifecycle_state <> 'active' then
      raise exception 'Ended credential lifecycle assignments are immutable';
    end if;

    if new.lifecycle_state='active' then
      raise exception 'Credential lifecycle assignment updates must end the assignment';
    end if;
  end if;

  return new;
end;
$$;

create trigger reservation_access_credential_assignments_validate
before insert or update on public.reservation_access_credential_assignments
for each row execute function icamp_private.validate_reservation_access_credential_assignment();

create trigger reservation_access_credential_assignments_touch
before update on public.reservation_access_credential_assignments
for each row execute function icamp_private.touch_row();

alter table public.campground_credential_lifecycle_policies enable row level security;
alter table public.campground_credential_lifecycle_policies force row level security;
alter table public.reservation_access_credential_assignments enable row level security;
alter table public.reservation_access_credential_assignments force row level security;

revoke all on public.campground_credential_lifecycle_policies from public;
revoke all on public.reservation_access_credential_assignments from public;

grant select,insert,update on public.campground_credential_lifecycle_policies to icamp_app;
grant select,insert,update on public.reservation_access_credential_assignments to icamp_app;

do $revoke_data_api$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.campground_credential_lifecycle_policies from anon';
    execute 'revoke all on public.reservation_access_credential_assignments from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.campground_credential_lifecycle_policies from authenticated';
    execute 'revoke all on public.reservation_access_credential_assignments from authenticated';
  end if;
end
$revoke_data_api$;

create policy campground_credential_lifecycle_policies_read
on public.campground_credential_lifecycle_policies
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
  or icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
);

create policy campground_credential_lifecycle_policies_insert
on public.campground_credential_lifecycle_policies
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy campground_credential_lifecycle_policies_update
on public.campground_credential_lifecycle_policies
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
)
with check (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy reservation_access_credential_assignments_read
on public.reservation_access_credential_assignments
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
  or icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
);

create policy reservation_access_credential_assignments_insert
on public.reservation_access_credential_assignments
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  and provisioned_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy reservation_access_credential_assignments_update
on public.reservation_access_credential_assignments
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
)
with check (
  icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
  and (
    ended_by_user_id is null
    or ended_by_user_id =
      nullif((select current_setting('icamp.user_id',true)),'')::uuid
  )
);

comment on table public.campground_credential_lifecycle_policies is
  'Build 062 campground-local checkout expiry policy for stay-managed access credentials.';

comment on table public.reservation_access_credential_assignments is
  'Build 062 reservation credential lifecycle assignments for arrival provisioning, stay synchronization, departure/cancellation revocation and lost/replacement evidence.';
