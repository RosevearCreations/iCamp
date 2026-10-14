-- iCamp Build 039
-- Rate Plans & Dynamic Date Pricing.

create table public.rate_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid,
  accommodation_kind text check (accommodation_kind in ('campsite','rental_cottage')),
  code text not null check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  currency_code text not null default 'CAD' check (currency_code ~ '^[A-Z]{3}$'),
  nightly_cents integer check (nightly_cents is null or nightly_cents >= 0),
  weekly_cents integer check (weekly_cents is null or weekly_cents >= 0),
  monthly_cents integer check (monthly_cents is null or monthly_cents >= 0),
  seasonal_cents integer check (seasonal_cents is null or seasonal_cents >= 0),
  yearly_cents integer check (yearly_cents is null or yearly_cents >= 0),
  starts_on date not null,
  ends_on date not null,
  priority integer not null default 100 check (priority between 0 and 100000),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint rate_plans_campground_fk foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on update cascade on delete restrict,
  constraint rate_plans_accommodation_fk foreign key (campground_id, accommodation_id)
    references public.accommodations(campground_id,id) on update cascade on delete restrict,
  constraint rate_plans_dates_check check (ends_on >= starts_on),
  constraint rate_plans_scope_check check (accommodation_id is not null or accommodation_kind is not null),
  constraint rate_plans_price_check check (
    nightly_cents is not null or weekly_cents is not null or monthly_cents is not null
    or seasonal_cents is not null or yearly_cents is not null
  ),
  constraint rate_plans_archive_shape_check check (
    (is_active and archived_at is null) or (not is_active and archived_at is not null)
  ),
  constraint rate_plans_scope_code_start_unique unique (campground_id, code, starts_on)
);

create table public.rate_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  rate_plan_id uuid not null references public.rate_plans(id) on update cascade on delete restrict,
  rule_kind text not null check (rule_kind in ('weekend','holiday','season','event','promotion')),
  calendar_period_id uuid references public.booking_calendar_periods(id) on update cascade on delete restrict,
  code text not null check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  starts_on date,
  ends_on date,
  adjustment_percent integer not null default 0 check (adjustment_percent between -100 and 500),
  adjustment_cents integer not null default 0 check (adjustment_cents between -10000000 and 10000000),
  priority integer not null default 100 check (priority between 0 and 100000),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint rate_rules_campground_fk foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on update cascade on delete restrict,
  constraint rate_rules_scope_check check (
    (calendar_period_id is not null and starts_on is null and ends_on is null)
    or (calendar_period_id is null and starts_on is not null and ends_on is not null and ends_on >= starts_on)
    or (rule_kind = 'weekend' and calendar_period_id is null and starts_on is null and ends_on is null)
  ),
  constraint rate_rules_scope_code_unique unique (rate_plan_id, code)
);

create index rate_plans_lookup_idx on public.rate_plans
  (campground_id, is_active, starts_on, ends_on, priority, accommodation_id, accommodation_kind);
create index rate_plans_created_by_fk_idx on public.rate_plans(created_by_user_id) where created_by_user_id is not null;
create index rate_plans_updated_by_fk_idx on public.rate_plans(updated_by_user_id) where updated_by_user_id is not null;
create index rate_rules_lookup_idx on public.rate_rules(rate_plan_id, is_active, priority, rule_kind);
create index rate_rules_period_fk_idx on public.rate_rules(calendar_period_id) where calendar_period_id is not null;
create index rate_rules_created_by_fk_idx on public.rate_rules(created_by_user_id) where created_by_user_id is not null;
create index rate_rules_updated_by_fk_idx on public.rate_rules(updated_by_user_id) where updated_by_user_id is not null;

create trigger rate_plans_touch_row before update on public.rate_plans
for each row execute function icamp_private.touch_row();
create trigger rate_rules_touch_row before update on public.rate_rules
for each row execute function icamp_private.touch_row();

alter table public.rate_plans enable row level security;
alter table public.rate_plans force row level security;
alter table public.rate_rules enable row level security;
alter table public.rate_rules force row level security;

revoke all on public.rate_plans from public;
revoke all on public.rate_rules from public;
do $build039_permissions$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.rate_plans from anon';
    execute 'revoke all on public.rate_rules from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.rate_plans from authenticated';
    execute 'revoke all on public.rate_rules from authenticated';
  end if;
end
$build039_permissions$;

grant select,insert,update on public.rate_plans to icamp_app;
grant select,insert,update on public.rate_rules to icamp_app;

create policy rate_plans_read on public.rate_plans for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'pricing.manage')
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.create')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);
create policy rate_plans_write on public.rate_plans for all to icamp_app
using (icamp_private.has_campground_permission(campground_id,'pricing.manage'))
with check (
  icamp_private.has_campground_permission(campground_id,'pricing.manage')
  and coalesce(updated_by_user_id,created_by_user_id) =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);
create policy rate_rules_read on public.rate_rules for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'pricing.manage')
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.create')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);
create policy rate_rules_write on public.rate_rules for all to icamp_app
using (icamp_private.has_campground_permission(campground_id,'pricing.manage'))
with check (
  icamp_private.has_campground_permission(campground_id,'pricing.manage')
  and coalesce(updated_by_user_id,created_by_user_id) =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on table public.rate_plans is
  'Build 039 canonical accommodation rate plans for nightly, weekly, monthly, seasonal and yearly pricing.';
comment on table public.rate_rules is
  'Build 039 dynamic weekend, holiday, season, event and promotional rate adjustments.';
