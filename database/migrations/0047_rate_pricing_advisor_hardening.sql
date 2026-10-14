-- iCamp Build 039 advisor hardening.
-- Close Supabase performance-advisor findings without changing pricing semantics.

create index rate_plans_accommodation_fk_idx
  on public.rate_plans(accommodation_id)
  where accommodation_id is not null;

create index rate_plans_campground_scope_fk_idx
  on public.rate_plans(organization_id, campground_id);

create index rate_rules_campground_scope_fk_idx
  on public.rate_rules(organization_id, campground_id);

drop policy if exists rate_plans_write on public.rate_plans;
drop policy if exists rate_rules_write on public.rate_rules;

create policy rate_plans_insert
on public.rate_plans
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  and (
    updated_by_user_id is null
    or updated_by_user_id =
      nullif((select current_setting('icamp.user_id', true)), '')::uuid
  )
);

create policy rate_plans_update
on public.rate_plans
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy rate_rules_insert
on public.rate_rules
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  and (
    updated_by_user_id is null
    or updated_by_user_id =
      nullif((select current_setting('icamp.user_id', true)), '')::uuid
  )
);

create policy rate_rules_update
on public.rate_rules
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on index public.rate_plans_accommodation_fk_idx is
  'Build 039 advisor hardening: covers accommodation foreign-key lookups.';
comment on index public.rate_plans_campground_scope_fk_idx is
  'Build 039 advisor hardening: covers campground composite foreign-key lookups.';
comment on index public.rate_rules_campground_scope_fk_idx is
  'Build 039 advisor hardening: covers campground composite foreign-key lookups.';
