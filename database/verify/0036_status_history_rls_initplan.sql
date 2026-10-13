-- Build 030 hosted-advisor hardening verification.
\set ON_ERROR_STOP on

do $build030_advisor_verify$
declare
  accommodation_check text;
  asset_check text;
begin
  select with_check
  into accommodation_check
  from pg_policies
  where schemaname = 'public'
    and tablename = 'accommodation_status_history'
    and policyname = 'accommodation_status_history_insert';

  select with_check
  into asset_check
  from pg_policies
  where schemaname = 'public'
    and tablename = 'operational_asset_status_history'
    and policyname = 'operational_asset_status_history_insert';

  if accommodation_check is null
     or position('current_setting' in lower(accommodation_check)) = 0
     or position('select' in lower(accommodation_check)) = 0 then
    raise exception 'Accommodation status-history insert policy does not cache user context through a scalar SELECT';
  end if;

  if asset_check is null
     or position('current_setting' in lower(asset_check)) = 0
     or position('select' in lower(asset_check)) = 0 then
    raise exception 'Operational asset status-history insert policy does not cache user context through a scalar SELECT';
  end if;
end
$build030_advisor_verify$;
