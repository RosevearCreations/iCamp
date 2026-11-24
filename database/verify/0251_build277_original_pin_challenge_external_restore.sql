-- Structure-only ephemeral CI validation; never original production acceptance.
do $$
declare tab text;
begin
 foreach tab in array array[
  'owner_peer_pin277','peer_challenge277','peer_challenge_response277',
  'external_restore_review277'
 ] loop
  if to_regclass('icamp_private.'||tab) is null then
   raise exception 'Build 277 table missing %',tab;end if;
  if not exists(
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=tab
    and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'Build 277 FORCE RLS missing %',tab;end if;
  if not exists(
   select 1 from pg_trigger t
    where t.tgrelid=to_regclass('icamp_private.'||tab)
      and t.tgenabled='O' and not t.tgisinternal
  ) then raise exception 'Build 277 immutable guard missing %',tab;end if;
 end loop;
 if not exists(
  select 1 from pg_constraint c
  where c.conrelid='icamp_private.peer_challenge_response277'::regclass
  and c.contype='u' and pg_get_constraintdef(c.oid) like '%challenge_id%'
 ) then raise exception 'Build 277 replay guard missing';end if;
 if not exists(
  select 1 from pg_constraint c
  where c.conrelid='icamp_private.owner_peer_pin277'::regclass
  and c.contype='u' and pg_get_constraintdef(c.oid) like '%proposal_id%'
 ) then raise exception 'Build 277 owner pin uniqueness missing';end if;
end $$;
