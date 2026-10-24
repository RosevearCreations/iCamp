do $verify$
declare org uuid := 'a8500000-0000-4000-8000-000000000001';
 camp uuid := 'a8500000-0000-4000-8000-000000000002';
begin
 if not exists(select 1 from public.campgrounds where id=camp and organization_id=org
  and name='Camp Rosevear' and slug='camp-rosevear-sample' and timezone='America/Toronto'
  and lifecycle_state='inactive') then raise exception 'Camp Rosevear inactive campground missing'; end if;
 if (select count(*) from public.campground_sections where campground_id=camp)<>4
  or (select count(*) from public.campground_subsections where campground_id=camp)<>4
  or (select count(*) from public.operational_facilities where campground_id=camp)<>4 then
  raise exception 'Camp Rosevear canonical geography or facility counts differ'; end if;
 if exists(select 1 from public.operational_assets where campground_id=camp
  and (operating_state<>'unavailable' or lifecycle_state<>'active')) then
  raise exception 'Camp Rosevear assets must be unavailable'; end if;
 if exists(select 1 from public.operational_facilities where campground_id=camp and guest_visibility<>'internal') then
  raise exception 'Camp Rosevear assets must be internal-only'; end if;
 if (select count(*) from public.waterfront_swim_zone_versions where campground_id=camp)<>3
  or (select count(*) from public.waterfront_swim_events where campground_id=camp)<>3
  or (select count(*) from public.waterfront_staff_training_events where campground_id=camp)<>1 then
  raise exception 'Camp Rosevear Build 085 evidence counts differ'; end if;
 if not exists(select 1 from public.waterfront_swim_events where campground_id=camp
  and zone_code='NORTH_SWIM' and kind='closure')
  or exists(select 1 from public.waterfront_swim_events where campground_id=camp and kind='reopen') then
  raise exception 'Camp Rosevear expected swimming closure must remain active'; end if;
 if (select count(*) from icamp_private.user_accounts where email_normalized like 'camp-rosevear-%@example.invalid'
  and account_state='disabled')<>2 then raise exception 'Disabled synthetic identities missing'; end if;
 if exists(select 1 from icamp_private.password_credentials p
  join icamp_private.user_accounts a on a.id=p.user_id where a.email_normalized like 'camp-rosevear-%@example.invalid')
  or exists(select 1 from icamp_private.auth_sessions s
  join icamp_private.user_accounts a on a.id=s.user_id where a.email_normalized like 'camp-rosevear-%@example.invalid') then
  raise exception 'Synthetic identities must not have login credentials or sessions'; end if;
 if exists(select 1 from public.reservations where campground_id=camp) then
  raise exception 'Demo campground must not have reservations'; end if;
end $verify$;
