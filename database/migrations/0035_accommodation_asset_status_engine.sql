-- iCamp Build 030
-- Accommodation & Asset Status Engine.

alter table public.accommodations
  add column status_state text not null default 'available';

alter table public.accommodations
  add constraint accommodations_status_state_check
  check (
    status_state in (
      'available',
      'held',
      'reserved',
      'arriving',
      'occupied',
      'departing',
      'inspection',
      'maintenance',
      'winterized',
      'closed'
    )
  );

alter table public.operational_assets
  drop constraint if exists operational_assets_operating_state_check;

alter table public.operational_assets
  add constraint operational_assets_operating_state_check
  check (
    operating_state in (
      'unknown',
      'operational',
      'limited',
      'inspection',
      'maintenance',
      'unavailable',
      'seasonal',
      'winterized',
      'closed'
    )
  );

create table icamp_private.accommodation_status_transition_rules (
  from_state text not null,
  to_state text not null,
  primary key (from_state, to_state),
  constraint accommodation_status_transition_from_check
    check (
      from_state in (
        'available',
        'held',
        'reserved',
        'arriving',
        'occupied',
        'departing',
        'inspection',
        'maintenance',
        'winterized',
        'closed'
      )
    ),
  constraint accommodation_status_transition_to_check
    check (
      to_state in (
        'available',
        'held',
        'reserved',
        'arriving',
        'occupied',
        'departing',
        'inspection',
        'maintenance',
        'winterized',
        'closed'
      )
    ),
  constraint accommodation_status_transition_change_check
    check (from_state <> to_state)
);

insert into icamp_private.accommodation_status_transition_rules (from_state, to_state)
values
  ('available', 'held'),
  ('available', 'reserved'),
  ('available', 'occupied'),
  ('available', 'inspection'),
  ('available', 'maintenance'),
  ('available', 'winterized'),
  ('available', 'closed'),
  ('held', 'available'),
  ('held', 'reserved'),
  ('held', 'maintenance'),
  ('held', 'closed'),
  ('reserved', 'available'),
  ('reserved', 'arriving'),
  ('reserved', 'occupied'),
  ('reserved', 'maintenance'),
  ('reserved', 'closed'),
  ('arriving', 'occupied'),
  ('arriving', 'inspection'),
  ('arriving', 'maintenance'),
  ('arriving', 'closed'),
  ('occupied', 'departing'),
  ('occupied', 'maintenance'),
  ('occupied', 'closed'),
  ('departing', 'inspection'),
  ('departing', 'maintenance'),
  ('departing', 'closed'),
  ('inspection', 'available'),
  ('inspection', 'maintenance'),
  ('inspection', 'winterized'),
  ('inspection', 'closed'),
  ('maintenance', 'inspection'),
  ('maintenance', 'available'),
  ('maintenance', 'winterized'),
  ('maintenance', 'closed'),
  ('winterized', 'inspection'),
  ('winterized', 'maintenance'),
  ('winterized', 'available'),
  ('winterized', 'closed'),
  ('closed', 'inspection'),
  ('closed', 'maintenance'),
  ('closed', 'available'),
  ('closed', 'winterized')
on conflict do nothing;

create table icamp_private.operational_asset_status_transition_rules (
  from_state text not null,
  to_state text not null,
  primary key (from_state, to_state),
  constraint operational_asset_status_transition_from_check
    check (
      from_state in (
        'unknown',
        'operational',
        'limited',
        'inspection',
        'maintenance',
        'unavailable',
        'seasonal',
        'winterized',
        'closed'
      )
    ),
  constraint operational_asset_status_transition_to_check
    check (
      to_state in (
        'unknown',
        'operational',
        'limited',
        'inspection',
        'maintenance',
        'unavailable',
        'seasonal',
        'winterized',
        'closed'
      )
    ),
  constraint operational_asset_status_transition_change_check
    check (from_state <> to_state)
);

insert into icamp_private.operational_asset_status_transition_rules (from_state, to_state)
values
  ('unknown', 'operational'),
  ('unknown', 'limited'),
  ('unknown', 'inspection'),
  ('unknown', 'maintenance'),
  ('unknown', 'unavailable'),
  ('unknown', 'seasonal'),
  ('unknown', 'winterized'),
  ('unknown', 'closed'),
  ('operational', 'limited'),
  ('operational', 'inspection'),
  ('operational', 'maintenance'),
  ('operational', 'unavailable'),
  ('operational', 'seasonal'),
  ('operational', 'winterized'),
  ('operational', 'closed'),
  ('limited', 'operational'),
  ('limited', 'inspection'),
  ('limited', 'maintenance'),
  ('limited', 'unavailable'),
  ('limited', 'seasonal'),
  ('limited', 'winterized'),
  ('limited', 'closed'),
  ('inspection', 'operational'),
  ('inspection', 'limited'),
  ('inspection', 'maintenance'),
  ('inspection', 'unavailable'),
  ('inspection', 'seasonal'),
  ('inspection', 'winterized'),
  ('inspection', 'closed'),
  ('maintenance', 'inspection'),
  ('maintenance', 'operational'),
  ('maintenance', 'limited'),
  ('maintenance', 'unavailable'),
  ('maintenance', 'seasonal'),
  ('maintenance', 'winterized'),
  ('maintenance', 'closed'),
  ('unavailable', 'inspection'),
  ('unavailable', 'maintenance'),
  ('unavailable', 'operational'),
  ('unavailable', 'limited'),
  ('unavailable', 'seasonal'),
  ('unavailable', 'winterized'),
  ('unavailable', 'closed'),
  ('seasonal', 'operational'),
  ('seasonal', 'limited'),
  ('seasonal', 'inspection'),
  ('seasonal', 'maintenance'),
  ('seasonal', 'unavailable'),
  ('seasonal', 'winterized'),
  ('seasonal', 'closed'),
  ('winterized', 'inspection'),
  ('winterized', 'maintenance'),
  ('winterized', 'seasonal'),
  ('winterized', 'operational'),
  ('winterized', 'unavailable'),
  ('winterized', 'closed'),
  ('closed', 'inspection'),
  ('closed', 'maintenance'),
  ('closed', 'operational'),
  ('closed', 'unavailable'),
  ('closed', 'winterized')
on conflict do nothing;

create table public.accommodation_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  from_state text,
  to_state text not null,
  reason text check (reason is null or char_length(trim(reason)) between 1 and 500),
  status_revision bigint not null check (status_revision >= 1),
  changed_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  changed_at timestamptz not null default statement_timestamp(),
  constraint accommodation_status_history_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint accommodation_status_history_from_state_check
    check (
      from_state is null
      or from_state in (
        'available',
        'held',
        'reserved',
        'arriving',
        'occupied',
        'departing',
        'inspection',
        'maintenance',
        'winterized',
        'closed'
      )
    ),
  constraint accommodation_status_history_to_state_check
    check (
      to_state in (
        'available',
        'held',
        'reserved',
        'arriving',
        'occupied',
        'departing',
        'inspection',
        'maintenance',
        'winterized',
        'closed'
      )
    )
);

create table public.operational_asset_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  asset_id uuid not null,
  asset_class text not null check (asset_class in ('facility', 'equipment')),
  from_state text,
  to_state text not null,
  reason text check (reason is null or char_length(trim(reason)) between 1 and 500),
  status_revision bigint not null check (status_revision >= 1),
  changed_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  changed_at timestamptz not null default statement_timestamp(),
  constraint operational_asset_status_history_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint operational_asset_status_history_from_state_check
    check (
      from_state is null
      or from_state in (
        'unknown',
        'operational',
        'limited',
        'inspection',
        'maintenance',
        'unavailable',
        'seasonal',
        'winterized',
        'closed'
      )
    ),
  constraint operational_asset_status_history_to_state_check
    check (
      to_state in (
        'unknown',
        'operational',
        'limited',
        'inspection',
        'maintenance',
        'unavailable',
        'seasonal',
        'winterized',
        'closed'
      )
    )
);

create index accommodation_status_history_scope_idx
  on public.accommodation_status_history (
    organization_id,
    campground_id,
    accommodation_id,
    changed_at desc
  );

create index accommodation_status_history_actor_idx
  on public.accommodation_status_history (changed_by_user_id)
  where changed_by_user_id is not null;

create index operational_asset_status_history_scope_idx
  on public.operational_asset_status_history (
    organization_id,
    campground_id,
    asset_id,
    changed_at desc
  );

create index operational_asset_status_history_actor_idx
  on public.operational_asset_status_history (changed_by_user_id)
  where changed_by_user_id is not null;

create or replace function icamp_private.validate_accommodation_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status_state is not distinct from new.status_state then
    return new;
  end if;

  if old.lifecycle_state = 'archived' or new.lifecycle_state = 'archived' then
    raise exception 'Archived accommodations cannot change operational status';
  end if;

  if not exists (
    select 1
    from icamp_private.accommodation_status_transition_rules rules
    where rules.from_state = old.status_state
      and rules.to_state = new.status_state
  ) then
    raise exception 'Accommodation status transition from % to % is not allowed',
      old.status_state,
      new.status_state;
  end if;

  new.status_revision := old.status_revision + 1;
  new.availability_revision := old.availability_revision + 1;
  return new;
end;
$$;

create or replace function icamp_private.record_accommodation_status_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_text text;
  actor_id uuid;
  transition_reason text;
begin
  actor_text := nullif(current_setting('icamp.user_id', true), '');
  if actor_text is not null then
    actor_id := actor_text::uuid;
  end if;

  if tg_op = 'INSERT' then
    insert into public.accommodation_status_history (
      organization_id,
      campground_id,
      accommodation_id,
      from_state,
      to_state,
      reason,
      status_revision,
      changed_by_user_id
    )
    values (
      new.organization_id,
      new.campground_id,
      new.id,
      null,
      new.status_state,
      null,
      new.status_revision,
      actor_id
    );
    return new;
  end if;

  if old.status_state is not distinct from new.status_state then
    return new;
  end if;

  transition_reason := nullif(trim(current_setting('icamp.status_reason', true)), '');

  insert into public.accommodation_status_history (
    organization_id,
    campground_id,
    accommodation_id,
    from_state,
    to_state,
    reason,
    status_revision,
    changed_by_user_id
  )
  values (
    new.organization_id,
    new.campground_id,
    new.id,
    old.status_state,
    new.status_state,
    transition_reason,
    new.status_revision,
    actor_id
  );

  return new;
end;
$$;

drop trigger if exists operational_assets_status_revision on public.operational_assets;
drop function if exists icamp_private.advance_operational_asset_status_revision();

create or replace function icamp_private.validate_operational_asset_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.operating_state is not distinct from new.operating_state then
    return new;
  end if;

  if old.lifecycle_state = 'archived' or new.lifecycle_state = 'archived' then
    raise exception 'Archived operational assets cannot change operating status';
  end if;

  if not exists (
    select 1
    from icamp_private.operational_asset_status_transition_rules rules
    where rules.from_state = old.operating_state
      and rules.to_state = new.operating_state
  ) then
    raise exception 'Operational asset status transition from % to % is not allowed',
      old.operating_state,
      new.operating_state;
  end if;

  new.status_revision := old.status_revision + 1;
  return new;
end;
$$;

create or replace function icamp_private.record_operational_asset_status_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_text text;
  actor_id uuid;
  transition_reason text;
begin
  actor_text := nullif(current_setting('icamp.user_id', true), '');
  if actor_text is not null then
    actor_id := actor_text::uuid;
  end if;

  if tg_op = 'INSERT' then
    insert into public.operational_asset_status_history (
      organization_id,
      campground_id,
      asset_id,
      asset_class,
      from_state,
      to_state,
      reason,
      status_revision,
      changed_by_user_id
    )
    values (
      new.organization_id,
      new.campground_id,
      new.id,
      new.asset_class,
      null,
      new.operating_state,
      null,
      new.status_revision,
      actor_id
    );
    return new;
  end if;

  if old.operating_state is not distinct from new.operating_state then
    return new;
  end if;

  transition_reason := nullif(trim(current_setting('icamp.status_reason', true)), '');

  insert into public.operational_asset_status_history (
    organization_id,
    campground_id,
    asset_id,
    asset_class,
    from_state,
    to_state,
    reason,
    status_revision,
    changed_by_user_id
  )
  values (
    new.organization_id,
    new.campground_id,
    new.id,
    new.asset_class,
    old.operating_state,
    new.operating_state,
    transition_reason,
    new.status_revision,
    actor_id
  );

  return new;
end;
$$;

create trigger accommodations_status_transition
before update of status_state on public.accommodations
for each row execute function icamp_private.validate_accommodation_status_transition();

create trigger accommodations_status_history_insert
after insert on public.accommodations
for each row execute function icamp_private.record_accommodation_status_history();

create trigger accommodations_status_history_update
after update of status_state on public.accommodations
for each row execute function icamp_private.record_accommodation_status_history();

create trigger operational_assets_status_transition
before update of operating_state on public.operational_assets
for each row execute function icamp_private.validate_operational_asset_status_transition();

create trigger operational_assets_status_history_insert
after insert on public.operational_assets
for each row execute function icamp_private.record_operational_asset_status_history();

create trigger operational_assets_status_history_update
after update of operating_state on public.operational_assets
for each row execute function icamp_private.record_operational_asset_status_history();

insert into public.accommodation_status_history (
  organization_id,
  campground_id,
  accommodation_id,
  from_state,
  to_state,
  reason,
  status_revision,
  changed_by_user_id,
  changed_at
)
select
  organization_id,
  campground_id,
  id,
  null,
  status_state,
  'Build 030 baseline',
  status_revision,
  updated_by_user_id,
  updated_at
from public.accommodations
where not exists (
  select 1
  from public.accommodation_status_history history
  where history.accommodation_id = accommodations.id
);

insert into public.operational_asset_status_history (
  organization_id,
  campground_id,
  asset_id,
  asset_class,
  from_state,
  to_state,
  reason,
  status_revision,
  changed_by_user_id,
  changed_at
)
select
  organization_id,
  campground_id,
  id,
  asset_class,
  null,
  operating_state,
  'Build 030 baseline',
  status_revision,
  updated_by_user_id,
  updated_at
from public.operational_assets
where not exists (
  select 1
  from public.operational_asset_status_history history
  where history.asset_id = operational_assets.id
);

alter table public.accommodation_status_history enable row level security;
alter table public.accommodation_status_history force row level security;
alter table public.operational_asset_status_history enable row level security;
alter table public.operational_asset_status_history force row level security;

revoke all on public.accommodation_status_history from public;
revoke all on public.operational_asset_status_history from public;
revoke all on icamp_private.accommodation_status_transition_rules from public;
revoke all on icamp_private.operational_asset_status_transition_rules from public;

do $build030_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.accommodation_status_history from anon';
    execute 'revoke all on public.operational_asset_status_history from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.accommodation_status_history from authenticated';
    execute 'revoke all on public.operational_asset_status_history from authenticated';
  end if;
end
$build030_permissions$;

grant select, insert on public.accommodation_status_history to icamp_app;
grant select, insert on public.operational_asset_status_history to icamp_app;
grant select on icamp_private.accommodation_status_transition_rules to icamp_app;
grant select on icamp_private.operational_asset_status_transition_rules to icamp_app;

create policy accommodation_status_history_read
on public.accommodation_status_history
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy accommodation_status_history_insert
on public.accommodation_status_history
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
  and changed_by_user_id =
    nullif(current_setting('icamp.user_id', true), '')::uuid
);

create policy operational_asset_status_history_read
on public.operational_asset_status_history
for select
to icamp_app
using (
  (
    asset_class = 'facility'
    and (
      icamp_private.has_campground_permission(campground_id, 'asset.read')
      or icamp_private.has_campground_permission(campground_id, 'asset.manage')
    )
  )
  or
  (
    asset_class = 'equipment'
    and (
      icamp_private.has_campground_permission(campground_id, 'equipment.read')
      or icamp_private.has_campground_permission(campground_id, 'equipment.manage')
    )
  )
);

create policy operational_asset_status_history_insert
on public.operational_asset_status_history
for insert
to icamp_app
with check (
  changed_by_user_id =
    nullif(current_setting('icamp.user_id', true), '')::uuid
  and (
    (
      asset_class = 'facility'
      and icamp_private.has_campground_permission(campground_id, 'asset.manage')
    )
    or
    (
      asset_class = 'equipment'
      and icamp_private.has_campground_permission(campground_id, 'equipment.manage')
    )
  )
);

comment on column public.accommodations.status_state is
  'Build 030 authoritative current accommodation status. Dated closures and bulk management holds arrive in Build 031.';
comment on table public.accommodation_status_history is
  'Append-only Build 030 accommodation status transition history. No update/delete grant is provided to the application role.';
comment on table public.operational_asset_status_history is
  'Append-only Build 030 facility/equipment status transition history. No update/delete grant is provided to the application role.';
comment on table icamp_private.accommodation_status_transition_rules is
  'Server-authoritative Build 030 accommodation state-machine edges.';
comment on table icamp_private.operational_asset_status_transition_rules is
  'Server-authoritative Build 030 operational asset state-machine edges.';
