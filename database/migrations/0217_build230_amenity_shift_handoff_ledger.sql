-- iCamp 230: durable, private amenity handoffs and owner guest-review requests.
-- This is a staff workflow. No guest publication, access or device state is changed.
create table public.amenity_shift_handoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  asset_id uuid not null,
  kind text not null check (kind in ('shift_handoff','guest_review')),
  priority text not null default 'normal'
    check (priority in ('normal','important','urgent')),
  summary text not null check (char_length(trim(summary)) between 8 and 500),
  next_action text not null check (char_length(trim(next_action)) between 8 and 500),
  status text not null default 'open'
    check (status in ('open','acknowledged','closed')),
  assigned_to_user_id uuid references icamp_private.user_accounts(id)
    on update cascade on delete set null,
  created_by_user_id uuid not null references icamp_private.user_accounts(id)
    on update cascade on delete restrict,
  acknowledged_by_user_id uuid references icamp_private.user_accounts(id)
    on update cascade on delete set null,
  acknowledged_at timestamptz,
  closed_by_user_id uuid references icamp_private.user_accounts(id)
    on update cascade on delete set null,
  closed_at timestamptz,
  resolution_note text not null default ''
    check (char_length(resolution_note) <= 500),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint amenity_shift_handoff_scope_fk
    foreign key (organization_id,campground_id,asset_id)
    references public.operational_assets(organization_id,campground_id,id)
    on update cascade on delete restrict,
  constraint amenity_shift_handoff_ack_pair check (
    (acknowledged_by_user_id is null) = (acknowledged_at is null)
  ),
  constraint amenity_shift_handoff_close_pair check (
    (closed_by_user_id is null) = (closed_at is null)
  ),
  constraint amenity_shift_handoff_closed_reason check (
    status <> 'closed' or (
      closed_at is not null and char_length(trim(resolution_note)) >= 8
    )
  )
);

create index amenity_shift_handoffs_campground_queue_idx
  on public.amenity_shift_handoffs
    (campground_id,kind,status,updated_at desc);
create index amenity_shift_handoffs_assignee_idx
  on public.amenity_shift_handoffs
    (campground_id,assigned_to_user_id,status)
  where status <> 'closed';
create index amenity_shift_handoffs_asset_fk_idx
  on public.amenity_shift_handoffs(organization_id,campground_id,asset_id);
create index amenity_shift_handoffs_creator_fk_idx
  on public.amenity_shift_handoffs(created_by_user_id);
create index amenity_shift_handoffs_acknowledger_fk_idx
  on public.amenity_shift_handoffs(acknowledged_by_user_id)
  where acknowledged_by_user_id is not null;
create index amenity_shift_handoffs_closer_fk_idx
  on public.amenity_shift_handoffs(closed_by_user_id)
  where closed_by_user_id is not null;
create index amenity_shift_handoffs_assignee_fk_idx
  on public.amenity_shift_handoffs(assigned_to_user_id)
  where assigned_to_user_id is not null;
create unique index amenity_shift_handoffs_one_pending_guest_review
  on public.amenity_shift_handoffs(campground_id,asset_id)
  where kind='guest_review' and status <> 'closed';

create function icamp_private.guard_amenity_handoff_transition()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  actor_id uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
  can_assign boolean;
  can_complete boolean;
  can_publish boolean;
begin
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.campground_id is distinct from old.campground_id
    or new.asset_id is distinct from old.asset_id
    or new.kind is distinct from old.kind
    or new.priority is distinct from old.priority
    or new.summary is distinct from old.summary
    or new.next_action is distinct from old.next_action
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Handoff identity and original evidence are immutable';
  end if;
  if old.status='closed' then raise exception 'Closed handoffs are immutable'; end if;
  can_assign := icamp_private.has_campground_permission(old.campground_id,'asset.manage')
    or icamp_private.has_campground_permission(old.campground_id,'maintenance.assign');
  can_complete := icamp_private.has_campground_permission(old.campground_id,'asset.manage')
    or icamp_private.has_campground_permission(old.campground_id,'maintenance.complete');
  can_publish := icamp_private.has_campground_permission(old.campground_id,'campground.configuration')
    and icamp_private.has_campground_permission(old.campground_id,'campground.map.publish');
  if new.assigned_to_user_id is distinct from old.assigned_to_user_id and not can_assign then
    raise exception 'Supervisor permission required for handoff reassignment';
  end if;
  if new.status='acknowledged' and old.status='open'
    and not (can_assign or old.assigned_to_user_id=actor_id) then
    raise exception 'Only the assignee or supervisor may acknowledge';
  end if;
  if new.status='closed' and not
    (case when old.kind='guest_review' then can_publish else can_complete end) then
    raise exception 'Required closure authority is missing';
  end if;
  if new.status not in (old.status,'acknowledged','closed','open')
    or (old.status='acknowledged' and new.status='open'
       and not (can_assign and new.assigned_to_user_id is distinct from old.assigned_to_user_id)) then
    raise exception 'Unsupported handoff state transition';
  end if;
  return new;
end $$;
revoke all on function icamp_private.guard_amenity_handoff_transition() from public;
create trigger amenity_shift_handoffs_guard
  before update on public.amenity_shift_handoffs
  for each row execute function icamp_private.guard_amenity_handoff_transition();

create trigger amenity_shift_handoffs_touch
  before update on public.amenity_shift_handoffs
  for each row execute function icamp_private.touch_row();

alter table public.amenity_shift_handoffs enable row level security;
alter table public.amenity_shift_handoffs force row level security;
revoke all on public.amenity_shift_handoffs from public;
grant select,insert,update on public.amenity_shift_handoffs to icamp_app;

create policy amenity_shift_handoffs_staff_read
  on public.amenity_shift_handoffs for select to icamp_app
  using (
    icamp_private.has_campground_permission(campground_id,'asset.read')
    or icamp_private.has_campground_permission(campground_id,'asset.manage')
    or icamp_private.has_campground_permission(campground_id,'maintenance.read')
    or icamp_private.has_campground_permission(campground_id,'maintenance.create')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  );
create policy amenity_shift_handoffs_staff_create
  on public.amenity_shift_handoffs for insert to icamp_app
  with check (
    created_by_user_id = nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and (
      icamp_private.has_campground_permission(campground_id,'asset.manage')
      or icamp_private.has_campground_permission(campground_id,'maintenance.create')
    )
  );
create policy amenity_shift_handoffs_staff_update
  on public.amenity_shift_handoffs for update to icamp_app
  using (
    icamp_private.has_campground_permission(campground_id,'asset.manage')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
    or (icamp_private.has_campground_permission(campground_id,'campground.configuration')
      and icamp_private.has_campground_permission(campground_id,'campground.map.publish'))
    or assigned_to_user_id = nullif((select current_setting('icamp.user_id',true)),'')::uuid
  )
  with check (
    icamp_private.has_campground_permission(campground_id,'asset.manage')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
    or (icamp_private.has_campground_permission(campground_id,'campground.configuration')
      and icamp_private.has_campground_permission(campground_id,'campground.map.publish'))
    or assigned_to_user_id = nullif((select current_setting('icamp.user_id',true)),'')::uuid
  );

comment on table public.amenity_shift_handoffs is
  'Private amenity staff handoffs and guest-review requests. A closed guest review is a recorded decision, never a published public status.';
