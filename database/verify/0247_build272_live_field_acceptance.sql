-- Build 272 ephemeral PostgreSQL contract checks (not original-production acceptance).
do $$
declare tab text;
begin
 foreach tab in array array[
 'owner_login_witness272','provider_booking_acceptance272',
 'comms_incident_review272','restore_dryrun_review272'
 ] loop
  if to_regclass('icamp_private.'||tab) is null then
   raise exception 'Build 272 source evidence table missing: %',tab;
  end if;
  if not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='icamp_private' and c.relname=tab
     and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'Build 272 FORCE RLS missing: %',tab;end if;
  if not exists(
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='icamp_private' and c.relname=tab
      and not t.tgisinternal and t.tgenabled='O'
  ) then raise exception 'Build 272 immutable source guard missing: %',tab;end if;
 end loop;
 if not exists(select 1 from pg_constraint c
   where c.conrelid='icamp_private.provider_booking_acceptance272'::regclass
    and c.contype='u'
    and pg_get_constraintdef(c.oid) like '%(recovery_id)%'
 ) then raise exception 'Repeated original booking acceptance prohibited';end if;
 if not exists(select 1 from pg_constraint c
   where c.conrelid='icamp_private.comms_incident_review272'::regclass
    and c.contype='u'
    and pg_get_constraintdef(c.oid) like '%(outbox_id)%'
 ) then raise exception 'Repeated original Comms acceptance prohibited';end if;
 if not exists(select 1 from pg_constraint c
   where c.conrelid='icamp_private.restore_dryrun_review272'::regclass
    and c.contype='u'
    and pg_get_constraintdef(c.oid) like '%(backup_sha256)%'
 ) then raise exception 'Original restore review duplicate source';end if;
end $$;
