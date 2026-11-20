-- Build 268: ephemeral original schema verification. This is not production adoption evidence.
do $$
declare tab text;
begin
 foreach tab in array array[
   'booking_recovery268','booking_recovery_events268','support_sla_outbox268'
 ] loop
   if to_regclass('icamp_private.'||tab) is null then
     raise exception 'Missing Build268 private ledger: %',tab;
   end if;
   if not exists(
     select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='icamp_private' and c.relname=tab and
       c.relrowsecurity and c.relforcerowsecurity
   ) then raise exception 'Build268 private ledger lacks FORCE RLS: %',tab; end if;
 end loop;
 if not exists(
   select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
   where c.oid='icamp_private.booking_recovery268'::regclass
     and t.tgname='booking_recovery268_guard' and not t.tgisinternal
 ) then raise exception 'Missing recovery case state guard';end if;
 if not exists(
   select 1 from pg_constraint where conname='support_sla_outbox268_case_id_alert_tier_key'
 ) then raise exception 'Missing durable SLA deduplication boundary';end if;
end $$;
