-- Build 194: per-user, per-campground Operations Command saved layouts.
-- Preferences contain layout metadata only: no booking, visitor, payment or source KPI records.
create table icamp_private.management_command_views (
  id uuid primary key,
  organization_id uuid not null,
  campground_id uuid not null,
  user_id uuid not null references icamp_private.user_accounts(id) on delete cascade,
  label text not null check (length(btrim(label)) between 3 and 48),
  perspective text not null default 'all'
    check (perspective in ('all','management','it','status','statistics')),
  category text not null default 'All tools'
    check (category in ('All tools','Bookings','Guest services','Property','Analytics','Administration')),
  search_term text not null default '' check(length(search_term)<=64),
  density text not null default 'comfortable' check(density in ('comfortable','compact')),
  favorite_hrefs text[] not null default '{}'::text[] check(cardinality(favorite_hrefs)<=8),
  kpi_order text[] not null default array['sites','arrivals','work_orders','financial']::text[]
    check(cardinality(kpi_order)=4 and kpi_order <@ array['sites','arrivals','work_orders','financial']::text[]),
  is_default boolean not null default false,
  row_version bigint not null default 1 check(row_version>=1),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(organization_id,campground_id,id),
  foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id) on delete restrict
);
create unique index management_command_views_label_unique on icamp_private.management_command_views(user_id,campground_id,lower(btrim(label)));
create unique index management_command_views_one_default on icamp_private.management_command_views(user_id,campground_id) where is_default;
create index management_command_views_scope_fk on icamp_private.management_command_views(organization_id,campground_id);
create index management_command_views_user_fk on icamp_private.management_command_views(user_id);

create function icamp_private.management_command_views_guard()
returns trigger language plpgsql security definer set search_path='' as $guard$
declare
  actor uuid;
  scope_org uuid;
begin
  actor:=nullif(current_setting('icamp.user_id',true),'')::uuid;
  if actor is null or new.user_id is distinct from actor
    or not icamp_private.has_campground_permission(new.campground_id,'reports.read') then
    raise exception 'Unauthorized management layout scope';
  end if;
  select organization_id into scope_org
    from public.campgrounds
    where id=new.campground_id and lifecycle_state='active';
  if not found or scope_org is distinct from new.organization_id then
    raise exception 'Campground scope unavailable for management layout';
  end if;
  if cardinality(new.favorite_hrefs)<>(
    select count(distinct href) from unnest(new.favorite_hrefs) href
  ) or exists(
    select 1 from unnest(new.favorite_hrefs) href
    where length(href)>160 or length(href)<5
      or (href not like '/workspaces/%' and href not like '/settings/%' and href<>'/status')
  ) then
    raise exception 'Invalid pinned management module keys';
  end if;
  if (select count(distinct kpi) from unnest(new.kpi_order) kpi)<>4 then
    raise exception 'Duplicate management KPI order keys';
  end if;
  if tg_op='INSERT' then
    -- Lock the user record to serialize the eight-layout limit across devices.
    perform 1 from icamp_private.user_accounts where id=actor for update;
    if (select count(*) from icamp_private.management_command_views
        where campground_id=new.campground_id and user_id=actor)>=8 then
      raise exception 'Maximum eight saved layouts per user and campground';
    end if;
    new.row_version:=1;
  else
    if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
      or new.campground_id is distinct from old.campground_id
      or new.user_id is distinct from old.user_id
      or new.created_at is distinct from old.created_at then
      raise exception 'Saved layout identity is immutable';
    end if;
    new.row_version:=old.row_version+1;
  end if;
  new.updated_at:=statement_timestamp();
  return new;
end $guard$;
create trigger management_command_views_guard_insert_update
before insert or update on icamp_private.management_command_views
for each row execute function icamp_private.management_command_views_guard();
revoke all on function icamp_private.management_command_views_guard() from public;

alter table icamp_private.management_command_views enable row level security;
alter table icamp_private.management_command_views force row level security;
revoke all on icamp_private.management_command_views from public;
do $revoke$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on icamp_private.management_command_views from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on icamp_private.management_command_views from authenticated;
  end if;
end $revoke$;
grant select,insert,update,delete on icamp_private.management_command_views to icamp_app;
create policy command_views_read on icamp_private.management_command_views
for select to icamp_app
using (user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
create policy command_views_insert on icamp_private.management_command_views
for insert to icamp_app
with check (user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
create policy command_views_update on icamp_private.management_command_views
for update to icamp_app
using (user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
  and icamp_private.has_campground_permission(campground_id,'reports.read'))
with check (user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
create policy command_views_delete on icamp_private.management_command_views
for delete to icamp_app
using (user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
comment on table icamp_private.management_command_views is
  'Build 194 saved staff layout and filter preferences only, with independent per-user/campground RLS; no source metrics or public access.';
