-- iCamp Build 064
-- Maintenance Taxonomy & Priority Model.
--
-- Establishes campground-scoped maintenance category identity and four canonical
-- priority policies. Build 065 later creates work orders that reference these
-- records instead of inventing a second classification model.

create table public.maintenance_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  category_code text not null
    check (
      category_code ~ '^[a-z][a-z0-9_]{1,49}$'
    ),
  display_name text not null
    check (char_length(trim(display_name)) between 2 and 80),
  description text
    check (description is null or char_length(description) <= 500),
  is_standard boolean not null default false,
  is_active boolean not null default true,
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint maintenance_categories_scope_code_key
    unique (campground_id, category_code),
  constraint maintenance_categories_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict
);

create index maintenance_categories_organization_campground_idx
  on public.maintenance_categories(organization_id, campground_id, is_active);
create index maintenance_categories_created_by_idx
  on public.maintenance_categories(created_by_user_id)
  where created_by_user_id is not null;
create index maintenance_categories_updated_by_idx
  on public.maintenance_categories(updated_by_user_id)
  where updated_by_user_id is not null;

create table public.maintenance_priority_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  priority_key text not null
    check (priority_key in ('emergency','urgent','normal','preventive')),
  target_response_minutes integer not null
    check (target_response_minutes between 1 and 43200),
  target_completion_minutes integer not null
    check (target_completion_minutes between 1 and 525600),
  instructions text
    check (instructions is null or char_length(instructions) <= 500),
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint maintenance_priority_policies_target_order_check
    check (target_completion_minutes >= target_response_minutes),
  constraint maintenance_priority_policies_scope_priority_key
    unique (campground_id, priority_key),
  constraint maintenance_priority_policies_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict
);

create index maintenance_priority_policies_organization_campground_idx
  on public.maintenance_priority_policies(organization_id, campground_id);
create index maintenance_priority_policies_updated_by_idx
  on public.maintenance_priority_policies(updated_by_user_id)
  where updated_by_user_id is not null;

create trigger maintenance_categories_touch
before update on public.maintenance_categories
for each row execute function icamp_private.touch_row();

create trigger maintenance_priority_policies_touch
before update on public.maintenance_priority_policies
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.guard_maintenance_category_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.category_code is distinct from new.category_code
     or old.is_standard is distinct from new.is_standard
     or old.created_by_user_id is distinct from new.created_by_user_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Maintenance category identity is immutable';
  end if;

  if old.is_standard
     and (
       old.display_name is distinct from new.display_name
       or old.description is distinct from new.description
     ) then
    raise exception 'Standard maintenance category labels are immutable';
  end if;

  return new;
end;
$$;

create trigger maintenance_categories_guard_update
before update on public.maintenance_categories
for each row execute function icamp_private.guard_maintenance_category_update();

create or replace function icamp_private.seed_maintenance_taxonomy_for_campground(
  p_organization_id uuid,
  p_campground_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.maintenance_categories (
    organization_id,
    campground_id,
    category_code,
    display_name,
    description,
    is_standard
  )
  values
    (p_organization_id,p_campground_id,'garbage','Garbage & Waste','Garbage collection, recycling, dumpsters and waste handling.',true),
    (p_organization_id,p_campground_id,'fire','Fire & Life Safety','Fire-related maintenance and life-safety equipment or infrastructure.',true),
    (p_organization_id,p_campground_id,'septic','Septic & Wastewater','Septic, sewer and wastewater systems.',true),
    (p_organization_id,p_campground_id,'water','Water Systems','Potable water, distribution, hydrants, taps and related systems.',true),
    (p_organization_id,p_campground_id,'electrical','Electrical','Electrical distribution, pedestals, lighting and related systems.',true),
    (p_organization_id,p_campground_id,'grounds','Grounds','Roads, trees, grass, drainage, landscaping and outdoor grounds.',true),
    (p_organization_id,p_campground_id,'building','Buildings & Facilities','Buildings, washrooms, offices, cottages and facility fabric.',true)
  on conflict (campground_id, category_code) do nothing;

  insert into public.maintenance_priority_policies (
    organization_id,
    campground_id,
    priority_key,
    target_response_minutes,
    target_completion_minutes,
    instructions
  )
  values
    (p_organization_id,p_campground_id,'emergency',15,60,'Immediate operational response target. Life-safety procedures and emergency services always take precedence.'),
    (p_organization_id,p_campground_id,'urgent',60,240,'Prompt same-shift response for serious operational impact that is not an emergency.'),
    (p_organization_id,p_campground_id,'normal',480,1440,'Routine response and completion planning target.'),
    (p_organization_id,p_campground_id,'preventive',1440,10080,'Planned preventive maintenance target; scheduling builds may refine due dates later.')
  on conflict (campground_id, priority_key) do nothing;
end;
$$;

select icamp_private.seed_maintenance_taxonomy_for_campground(
  c.organization_id,
  c.id
)
from public.campgrounds c
where c.lifecycle_state <> 'archived';

create or replace function icamp_private.seed_maintenance_taxonomy_after_campground()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform icamp_private.seed_maintenance_taxonomy_for_campground(
    new.organization_id,
    new.id
  );
  return new;
end;
$$;

create trigger campgrounds_seed_maintenance_taxonomy
after insert on public.campgrounds
for each row execute function icamp_private.seed_maintenance_taxonomy_after_campground();

alter table public.maintenance_categories enable row level security;
alter table public.maintenance_categories force row level security;
alter table public.maintenance_priority_policies enable row level security;
alter table public.maintenance_priority_policies force row level security;

revoke all on public.maintenance_categories from public;
revoke all on public.maintenance_priority_policies from public;

grant select,insert,update on public.maintenance_categories to icamp_app;
grant select,update on public.maintenance_priority_policies to icamp_app;

do $revoke_data_api$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.maintenance_categories from anon';
    execute 'revoke all on public.maintenance_priority_policies from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.maintenance_categories from authenticated';
    execute 'revoke all on public.maintenance_priority_policies from authenticated';
  end if;
end
$revoke_data_api$;

create policy maintenance_categories_read
on public.maintenance_categories
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  or icamp_private.has_campground_permission(campground_id,'campground.configuration')
);

create policy maintenance_categories_insert
on public.maintenance_categories
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  and is_standard = false
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy maintenance_categories_update
on public.maintenance_categories
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.assign')
)
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy maintenance_priority_policies_read
on public.maintenance_priority_policies
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  or icamp_private.has_campground_permission(campground_id,'campground.configuration')
);

create policy maintenance_priority_policies_update
on public.maintenance_priority_policies
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.assign')
)
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

comment on table public.maintenance_categories is
  'Build 064 campground-scoped maintenance taxonomy. Standard and custom categories remain canonical identifiers for later work orders.';

comment on table public.maintenance_priority_policies is
  'Build 064 campground-configurable Emergency/Urgent/Normal/Preventive response and completion planning targets.';
