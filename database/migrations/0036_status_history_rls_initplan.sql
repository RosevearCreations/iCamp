-- iCamp Build 030 hosted-advisor hardening.
-- Cache request context once per statement inside status-history INSERT RLS policies.

drop policy if exists accommodation_status_history_insert
on public.accommodation_status_history;

create policy accommodation_status_history_insert
on public.accommodation_status_history
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
  and changed_by_user_id = (
    select nullif(current_setting('icamp.user_id', true), '')::uuid
  )
);

drop policy if exists operational_asset_status_history_insert
on public.operational_asset_status_history;

create policy operational_asset_status_history_insert
on public.operational_asset_status_history
for insert
to icamp_app
with check (
  changed_by_user_id = (
    select nullif(current_setting('icamp.user_id', true), '')::uuid
  )
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

comment on policy accommodation_status_history_insert
on public.accommodation_status_history is
  'Build 030 insert guard with once-per-statement user-context evaluation for RLS performance.';

comment on policy operational_asset_status_history_insert
on public.operational_asset_status_history is
  'Build 030 insert guard with once-per-statement user-context evaluation for RLS performance.';
