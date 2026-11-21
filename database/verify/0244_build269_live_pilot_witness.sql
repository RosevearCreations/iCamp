-- Build 269 ephemeral guard checks; never proof of original production migration.
do $$
declare tab text;
begin
 foreach tab in array array[
  'traffic_stage269','support_delivery_receipts269',
  'pilot_booking_witness269','pilot_restore_witness269'
 ] loop
  if to_regclass('icamp_private.'||tab) is null then
    raise exception 'Missing Build 269 original private schema %',tab;
  end if;
  if not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relname=tab and n.nspname='icamp_private'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'Missing FORCE RLS on Build 269 %',tab;end if;
  if not exists(
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where c.relname=tab and n.nspname='icamp_private'
      and not t.tgisinternal
  ) then raise exception 'Missing immutable original guard for %',tab;end if;
 end loop;
 if not exists(select 1 from pg_constraint where conname=
  'traffic_stage269_campground_id_source_id_nonce_key'
 ) then raise exception 'Traffic deduplication missing';end if;
 if not exists(select 1 from pg_constraint where conname=
  'support_delivery_receipts269_source_id_provider_event_id_key'
 ) then raise exception 'Original Comms provider event deduplication missing';end if;
end $$;
