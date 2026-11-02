-- iCamp Build 073
-- Departure Campsite Cleanup.
--
-- Reuses Build 050 checkout evidence, Build 068 versioned site inspections,
-- Build 065 corrective work orders and Build 030 accommodation availability.
-- No duplicate checklist, booking-state or issue-closure authority is created.

create table public.campsite_departure_cleanup_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  campsite_type text not null
    check (campsite_type in ('tent','rv','mixed')),
  inspection_template_id uuid not null,
  block_rebooking_until_clear boolean not null default true,
  notes text
    check (notes is null or char_length(notes) <= 2000),
  is_active boolean not null default true,
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  updated_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campsite_departure_cleanup_programs_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint campsite_departure_cleanup_programs_accommodation_unique
    unique (accommodation_id),
  constraint campsite_departure_cleanup_programs_accommodation_fk
    foreign key (organization_id,campground_id,accommodation_id)
    references public.accommodations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint campsite_departure_cleanup_programs_template_fk
    foreign key (organization_id,campground_id,inspection_template_id)
    references public.inspection_templates(organization_id,campground_id,id)
    on update cascade
    on delete restrict
);

create table public.campsite_departure_cleanup_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_check_out_id uuid not null,
  reservation_id uuid not null,
  accommodation_id uuid not null,
  program_id uuid,
  campsite_type text not null
    check (campsite_type in ('tent','rv','mixed')),
  inspection_occurrence_id uuid,
  block_rebooking_until_clear boolean not null default true,
  cleared_at timestamptz,
  cleared_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campsite_departure_cleanup_tasks_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint campsite_departure_cleanup_tasks_checkout_unique
    unique (reservation_check_out_id),
  constraint campsite_departure_cleanup_tasks_occurrence_unique
    unique (inspection_occurrence_id),
  constraint campsite_departure_cleanup_tasks_checkout_fk
    foreign key (organization_id,campground_id,reservation_check_out_id)
    references public.reservation_check_outs(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint campsite_departure_cleanup_tasks_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint campsite_departure_cleanup_tasks_accommodation_fk
    foreign key (organization_id,campground_id,accommodation_id)
    references public.accommodations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint campsite_departure_cleanup_tasks_program_fk
    foreign key (organization_id,campground_id,program_id)
    references public.campsite_departure_cleanup_programs(
      organization_id,campground_id,id
    )
    on update cascade
    on delete restrict,
  constraint campsite_departure_cleanup_tasks_occurrence_fk
    foreign key (organization_id,campground_id,inspection_occurrence_id)
    references public.inspection_occurrences(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint campsite_departure_cleanup_tasks_clearance_check
    check (
      (cleared_at is null and cleared_by_user_id is null)
      or
      (cleared_at is not null and cleared_by_user_id is not null)
    )
);

create index campsite_departure_cleanup_programs_scope_idx
  on public.campsite_departure_cleanup_programs(
    campground_id,is_active,campsite_type,accommodation_id
  );

create index campsite_departure_cleanup_programs_template_idx
  on public.campsite_departure_cleanup_programs(
    organization_id,campground_id,inspection_template_id
  );

create index campsite_departure_cleanup_programs_created_by_idx
  on public.campsite_departure_cleanup_programs(created_by_user_id);

create index campsite_departure_cleanup_programs_updated_by_idx
  on public.campsite_departure_cleanup_programs(updated_by_user_id);

create index campsite_departure_cleanup_tasks_queue_idx
  on public.campsite_departure_cleanup_tasks(
    campground_id,cleared_at,created_at desc
  );

create index campsite_departure_cleanup_tasks_reservation_idx
  on public.campsite_departure_cleanup_tasks(
    organization_id,campground_id,reservation_id
  );

create index campsite_departure_cleanup_tasks_accommodation_idx
  on public.campsite_departure_cleanup_tasks(
    organization_id,campground_id,accommodation_id,created_at desc
  );

create index campsite_departure_cleanup_tasks_program_idx
  on public.campsite_departure_cleanup_tasks(
    organization_id,campground_id,program_id
  )
  where program_id is not null;

create index campsite_departure_cleanup_tasks_created_by_idx
  on public.campsite_departure_cleanup_tasks(created_by_user_id);

create index campsite_departure_cleanup_tasks_cleared_by_idx
  on public.campsite_departure_cleanup_tasks(cleared_by_user_id)
  where cleared_by_user_id is not null;

create trigger campsite_departure_cleanup_programs_touch_row
before update on public.campsite_departure_cleanup_programs
for each row execute function icamp_private.touch_row();

create trigger campsite_departure_cleanup_tasks_touch_row
before update on public.campsite_departure_cleanup_tasks
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.validate_campsite_departure_cleanup_program()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_kind text;
  template_kind text;
  template_accommodation_id uuid;
  template_active boolean;
  template_published_at timestamptz;
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  select cs.campsite_type
    into actual_kind
  from public.accommodations a
  join public.campsites cs
    on cs.accommodation_id=a.id
   and cs.organization_id=a.organization_id
   and cs.campground_id=a.campground_id
  where a.id=new.accommodation_id
    and a.organization_id=new.organization_id
    and a.campground_id=new.campground_id
    and a.accommodation_kind='campsite'
    and a.lifecycle_state <> 'archived';

  if actual_kind is null then
    raise exception 'Departure cleanup program must target a canonical campsite';
  end if;

  if actual_kind <> new.campsite_type then
    raise exception 'Departure cleanup campsite type must match canonical campsite type';
  end if;

  select t.target_kind,t.accommodation_id,t.is_active,v.published_at
    into template_kind,template_accommodation_id,template_active,template_published_at
  from public.inspection_templates t
  join public.inspection_template_versions v
    on v.id=t.current_version_id
   and v.organization_id=t.organization_id
   and v.campground_id=t.campground_id
  where t.id=new.inspection_template_id
    and t.organization_id=new.organization_id
    and t.campground_id=new.campground_id;

  if template_kind is distinct from 'site'
     or template_accommodation_id is distinct from new.accommodation_id then
    raise exception 'Departure cleanup requires a site inspection template for the same campsite';
  end if;

  if new.is_active
     and (template_active is distinct from true or template_published_at is null) then
    raise exception 'Active departure cleanup requires an active published site inspection template';
  end if;

  if actor_id is not null then
    if tg_op='INSERT' and new.created_by_user_id is distinct from actor_id then
      raise exception 'Departure cleanup program creator must match the request actor';
    end if;
    if new.updated_by_user_id is distinct from actor_id then
      raise exception 'Departure cleanup program updater must match the request actor';
    end if;
  end if;

  return new;
end;
$$;

create trigger campsite_departure_cleanup_programs_validate
before insert or update on public.campsite_departure_cleanup_programs
for each row execute function icamp_private.validate_campsite_departure_cleanup_program();

create or replace function icamp_private.validate_campsite_departure_cleanup_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout_reservation_id uuid;
  checkout_accommodation_id uuid;
  checkout_kind text;
  actual_campsite_type text;
  program_accommodation_id uuid;
  program_campsite_type text;
  program_template_id uuid;
  occurrence_accommodation_id uuid;
  occurrence_template_id uuid;
  occurrence_target_kind text;
  occurrence_status text;
  unresolved_count integer;
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  if tg_op='UPDATE' and (
    old.organization_id is distinct from new.organization_id
    or old.campground_id is distinct from new.campground_id
    or old.reservation_check_out_id is distinct from new.reservation_check_out_id
    or old.reservation_id is distinct from new.reservation_id
    or old.accommodation_id is distinct from new.accommodation_id
    or old.campsite_type is distinct from new.campsite_type
    or old.created_by_user_id is distinct from new.created_by_user_id
    or old.created_at is distinct from new.created_at
  ) then
    raise exception 'Departure cleanup task identity is immutable';
  end if;

  select co.reservation_id,co.accommodation_id,co.turnover_kind,cs.campsite_type
    into checkout_reservation_id,checkout_accommodation_id,checkout_kind,actual_campsite_type
  from public.reservation_check_outs co
  join public.accommodations a
    on a.id=co.accommodation_id
   and a.organization_id=co.organization_id
   and a.campground_id=co.campground_id
  join public.campsites cs
    on cs.accommodation_id=a.id
   and cs.organization_id=a.organization_id
   and cs.campground_id=a.campground_id
  where co.id=new.reservation_check_out_id
    and co.organization_id=new.organization_id
    and co.campground_id=new.campground_id
    and a.accommodation_kind='campsite';

  if checkout_reservation_id is null
     or checkout_kind <> 'post_departure_inspection'
     or checkout_reservation_id is distinct from new.reservation_id
     or checkout_accommodation_id is distinct from new.accommodation_id
     or actual_campsite_type is distinct from new.campsite_type then
    raise exception 'Departure cleanup task must match canonical campsite checkout evidence';
  end if;

  if new.program_id is not null then
    select p.accommodation_id,p.campsite_type,p.inspection_template_id
      into program_accommodation_id,program_campsite_type,program_template_id
    from public.campsite_departure_cleanup_programs p
    where p.id=new.program_id
      and p.organization_id=new.organization_id
      and p.campground_id=new.campground_id;

    if program_accommodation_id is distinct from new.accommodation_id
       or program_campsite_type is distinct from new.campsite_type then
      raise exception 'Departure cleanup task program must target the same campsite and type';
    end if;
  end if;

  if new.inspection_occurrence_id is not null then
    if new.program_id is null then
      raise exception 'Departure cleanup inspection requires a configured cleanup program';
    end if;

    select o.accommodation_id,o.template_id,o.target_kind,o.status
      into occurrence_accommodation_id,occurrence_template_id,occurrence_target_kind,occurrence_status
    from public.inspection_occurrences o
    where o.id=new.inspection_occurrence_id
      and o.organization_id=new.organization_id
      and o.campground_id=new.campground_id;

    if occurrence_target_kind is distinct from 'site'
       or occurrence_accommodation_id is distinct from new.accommodation_id
       or occurrence_template_id is distinct from program_template_id then
      raise exception 'Departure cleanup inspection must be the configured site inspection for the same campsite';
    end if;
  end if;

  if new.cleared_at is not null then
    if new.inspection_occurrence_id is null
       or occurrence_status is distinct from 'signed_off' then
      raise exception 'Departure cleanup can clear only after canonical inspection sign-off';
    end if;

    select count(*)::integer
      into unresolved_count
    from public.inspection_corrective_actions ca
    join public.maintenance_work_orders wo
      on wo.id=ca.work_order_id
     and wo.organization_id=ca.organization_id
     and wo.campground_id=ca.campground_id
    join public.inspection_results ir
      on ir.id=ca.inspection_result_id
     and ir.organization_id=ca.organization_id
     and ir.campground_id=ca.campground_id
    where ir.occurrence_id=new.inspection_occurrence_id
      and wo.status not in ('completed','cancelled');

    if unresolved_count > 0 then
      raise exception 'Departure cleanup cannot clear while corrective work remains open';
    end if;

    if actor_id is not null and new.cleared_by_user_id is distinct from actor_id then
      raise exception 'Departure cleanup clearance actor must match the request actor';
    end if;
  end if;

  if tg_op='INSERT'
     and actor_id is not null
     and new.created_by_user_id is distinct from actor_id then
    raise exception 'Departure cleanup task creator must match the request actor';
  end if;

  return new;
end;
$$;

create trigger campsite_departure_cleanup_tasks_validate
before insert or update on public.campsite_departure_cleanup_tasks
for each row execute function icamp_private.validate_campsite_departure_cleanup_task();

create or replace function icamp_private.create_campsite_departure_cleanup_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_kind text;
  selected_program record;
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  if new.turnover_kind <> 'post_departure_inspection' then
    return new;
  end if;

  select cs.campsite_type
    into actual_kind
  from public.accommodations a
  join public.campsites cs
    on cs.accommodation_id=a.id
   and cs.organization_id=a.organization_id
   and cs.campground_id=a.campground_id
  where a.id=new.accommodation_id
    and a.organization_id=new.organization_id
    and a.campground_id=new.campground_id
    and a.accommodation_kind='campsite';

  if actual_kind is null then
    return new;
  end if;

  if actor_id is distinct from new.checked_out_by_user_id then
    raise exception 'Departure cleanup checkout actor does not match request actor';
  end if;

  if not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'reservation.modify is required to create departure cleanup handoff';
  end if;

  select p.id,p.block_rebooking_until_clear
    into selected_program
  from public.campsite_departure_cleanup_programs p
  where p.organization_id=new.organization_id
    and p.campground_id=new.campground_id
    and p.accommodation_id=new.accommodation_id
    and p.campsite_type=actual_kind
    and p.is_active
  limit 1;

  insert into public.campsite_departure_cleanup_tasks (
    organization_id,campground_id,reservation_check_out_id,reservation_id,
    accommodation_id,program_id,campsite_type,block_rebooking_until_clear,
    created_by_user_id
  )
  values (
    new.organization_id,new.campground_id,new.id,new.reservation_id,
    new.accommodation_id,selected_program.id,actual_kind,
    coalesce(selected_program.block_rebooking_until_clear,true),
    new.checked_out_by_user_id
  )
  on conflict (reservation_check_out_id) do nothing;

  return new;
end;
$$;

create trigger reservation_check_outs_create_campsite_cleanup
after insert on public.reservation_check_outs
for each row execute function icamp_private.create_campsite_departure_cleanup_task();

create or replace function icamp_private.guard_campsite_cleanup_rebooking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status_state='inspection'
     and new.status_state='available'
     and exists (
       select 1
       from public.campsite_departure_cleanup_tasks t
       where t.organization_id=new.organization_id
         and t.campground_id=new.campground_id
         and t.accommodation_id=new.id
         and t.cleared_at is null
         and t.block_rebooking_until_clear
     ) then
    raise exception 'Campsite remains blocked for rebooking until departure cleanup is cleared';
  end if;

  return new;
end;
$$;

create trigger accommodations_guard_campsite_cleanup_rebooking
before update of status_state on public.accommodations
for each row execute function icamp_private.guard_campsite_cleanup_rebooking();

revoke all on function icamp_private.validate_campsite_departure_cleanup_program() from public;
revoke all on function icamp_private.validate_campsite_departure_cleanup_task() from public;
revoke all on function icamp_private.create_campsite_departure_cleanup_task() from public;
revoke all on function icamp_private.guard_campsite_cleanup_rebooking() from public;

alter table public.campsite_departure_cleanup_programs enable row level security;
alter table public.campsite_departure_cleanup_programs force row level security;
alter table public.campsite_departure_cleanup_tasks enable row level security;
alter table public.campsite_departure_cleanup_tasks force row level security;

revoke all on public.campsite_departure_cleanup_programs from public;
revoke all on public.campsite_departure_cleanup_tasks from public;

do $build073_direct_roles$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.campsite_departure_cleanup_programs from anon';
    execute 'revoke all on public.campsite_departure_cleanup_tasks from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.campsite_departure_cleanup_programs from authenticated';
    execute 'revoke all on public.campsite_departure_cleanup_tasks from authenticated';
  end if;
end
$build073_direct_roles$;

grant select,insert,update on public.campsite_departure_cleanup_programs to icamp_app;
grant select,insert,update on public.campsite_departure_cleanup_tasks to icamp_app;

create policy campsite_departure_cleanup_programs_read
on public.campsite_departure_cleanup_programs
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  or icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  or icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
  or icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);

create policy campsite_departure_cleanup_programs_insert
on public.campsite_departure_cleanup_programs
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  or icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
);

create policy campsite_departure_cleanup_programs_update
on public.campsite_departure_cleanup_programs
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  or icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  or icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
);

create policy campsite_departure_cleanup_tasks_read
on public.campsite_departure_cleanup_tasks
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  or icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);

create policy campsite_departure_cleanup_tasks_insert
on public.campsite_departure_cleanup_tasks
for insert to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id,'reservation.modify')
    or icamp_private.has_campground_permission(campground_id,'maintenance.create')
    or icamp_private.has_campground_permission(campground_id,'inspection.perform')
  )
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy campsite_departure_cleanup_tasks_update
on public.campsite_departure_cleanup_tasks
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  or icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
)
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  or icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
);

insert into public.campsite_departure_cleanup_tasks (
  organization_id,campground_id,reservation_check_out_id,reservation_id,
  accommodation_id,program_id,campsite_type,block_rebooking_until_clear,
  created_by_user_id,created_at
)
select
  co.organization_id,
  co.campground_id,
  co.id,
  co.reservation_id,
  co.accommodation_id,
  p.id,
  cs.campsite_type,
  coalesce(p.block_rebooking_until_clear,true),
  co.checked_out_by_user_id,
  co.checked_out_at
from public.reservation_check_outs co
join public.accommodations a
  on a.id=co.accommodation_id
 and a.organization_id=co.organization_id
 and a.campground_id=co.campground_id
join public.campsites cs
  on cs.accommodation_id=a.id
 and cs.organization_id=a.organization_id
 and cs.campground_id=a.campground_id
left join public.campsite_departure_cleanup_programs p
  on p.organization_id=co.organization_id
 and p.campground_id=co.campground_id
 and p.accommodation_id=co.accommodation_id
 and p.campsite_type=cs.campsite_type
 and p.is_active
where co.turnover_kind='post_departure_inspection'
  and a.accommodation_kind='campsite'
on conflict (reservation_check_out_id) do nothing;

comment on table public.campsite_departure_cleanup_programs is
  'Build 073 per-campsite departure cleanup configuration. Build 068 remains checklist/inspection authority and Build 030 remains availability authority.';

comment on table public.campsite_departure_cleanup_tasks is
  'Build 073 checkout-to-inspection handoff and clearance evidence. Checklist results live in Build 068 and corrective issue closure lives in Build 065 work orders.';

comment on column public.campsite_departure_cleanup_tasks.block_rebooking_until_clear is
  'Checkout-time policy snapshot. When true, canonical accommodation status remains inspection until clearance; no duplicate booking-state flag is created.';
