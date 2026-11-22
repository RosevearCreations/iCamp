-- Build 273 clean ephemeral schema verification (not original-host certification).
do $$
declare tab text;
begin
 foreach tab in array array[
 'source_enrollment_review273','consumer_ack273',
 'incident_ack_closure273','restore_provider_attestation273'
 ] loop
  if to_regclass('icamp_private.'||tab) is null then
   raise exception 'Missing Build 273 private table %',tab;
  end if;
  if not exists(
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where c.relname=tab and n.nspname='icamp_private'
    and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'Missing Build 273 FORCE RLS %',tab;end if;
  if not exists(
   select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
   join pg_namespace n on n.oid=c.relnamespace
   where c.relname=tab and n.nspname='icamp_private'
     and not t.tgisinternal and t.tgenabled='O'
  ) then raise exception 'Missing Build 273 immutable trigger %',tab;end if;
 end loop;
 if not exists(
  select 1 from pg_constraint c where
   c.conrelid='icamp_private.consumer_ack273'::regclass and
   c.contype='u' and pg_get_constraintdef(c.oid)
     like '%(source_id, nonce)%'
 ) then raise exception 'Consumer receipt nonce replay not protected';end if;
 if not exists(
  select 1 from pg_constraint c where
   c.conrelid='icamp_private.restore_provider_attestation273'::regclass and
   c.contype='c' and pg_get_constraintdef(c.oid) like '%source_host_sha256%'
 ) then raise exception 'Isolated and original host must be different';end if;
end $$;
