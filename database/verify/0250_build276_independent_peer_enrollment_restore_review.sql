-- Ephemeral structural verification only; production original host/source acceptance separate.
do $$
declare tab text;
begin
 foreach tab in array array[
  'peer_signer_proposal276','peer_signer_review276','restore_closure_review276'
 ] loop
  if to_regclass('icamp_private.'||tab) is null then
   raise exception 'Missing Build 276 table %',tab;
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relname=tab and n.nspname='icamp_private'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'Build 276 FORCE RLS missing %',tab; end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where c.relname=tab and n.nspname='icamp_private'
      and not t.tgisinternal and t.tgenabled='O'
  ) then raise exception 'Build 276 immutable guard missing %',tab; end if;
 end loop;
 if not exists (
   select 1 from pg_constraint c
   where c.conrelid='icamp_private.peer_signer_review276'::regclass
     and c.contype='u' and pg_get_constraintdef(c.oid) like '%proposal_id%'
 ) then raise exception 'Build 276 duplicate signer review guard missing'; end if;
 if not exists (
   select 1 from pg_constraint c
   where c.conrelid='icamp_private.restore_closure_review276'::regclass
     and c.contype='u' and pg_get_constraintdef(c.oid) like '%provider_attestation_id%'
 ) then raise exception 'Build 276 restore replay guard missing'; end if;
end $$;
