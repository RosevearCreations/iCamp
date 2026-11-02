-- iCamp Build 186: one database-level stop for premature availability release.
-- Existing campsite/cottage sign-offs remain the only turnover authorities.

create index if not exists maintenance_work_orders_open_accommodation_release_idx
  on public.maintenance_work_orders (
    organization_id,campground_id,accommodation_id
  )
  where accommodation_id is not null
    and status not in ('completed','cancelled');

-- Serialize creation/reopening of site work with turnover release. Both
-- canonical release services lock accommodations before their final recheck.
create or replace function icamp_private.lock_accommodation_on_work_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.accommodation_id is not null
     and new.status not in ('completed','cancelled') then
    perform 1
    from public.accommodations a
    where a.organization_id=new.organization_id
      and a.campground_id=new.campground_id
      and a.id=new.accommodation_id
    for update;
  end if;
  return new;
end;
$$;

create trigger maintenance_work_orders_serialize_accommodation_release
before insert or update of accommodation_id,status
on public.maintenance_work_orders
for each row execute function icamp_private.lock_accommodation_on_work_order_change();

create or replace function icamp_private.guard_unresolved_maintenance_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status_state='available'
     and old.status_state is distinct from 'available'
     and exists (
       select 1
       from public.maintenance_work_orders wo
       where wo.organization_id=new.organization_id
         and wo.campground_id=new.campground_id
         and wo.accommodation_id=new.id
         and wo.status not in ('completed','cancelled')
     ) then
    raise exception 'Accommodation cannot become available while linked maintenance work orders remain open';
  end if;
  return new;
end;
$$;

create trigger accommodations_guard_unresolved_maintenance_release
before update of status_state on public.accommodations
for each row execute function icamp_private.guard_unresolved_maintenance_release();

revoke all on function icamp_private.guard_unresolved_maintenance_release()
  from public;
revoke all on function icamp_private.lock_accommodation_on_work_order_change()
  from public;

comment on function icamp_private.guard_unresolved_maintenance_release() is
  'Build 186 canonical availability guard: no status_state release with open site-scoped maintenance; preserves campsite and cottage turnover release rules.';
