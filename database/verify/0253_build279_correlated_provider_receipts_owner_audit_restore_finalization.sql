-- Disposable migration CI checks; no original production evidence or certification.
do $$
declare tab text;
begin
 foreach tab in array array[
  'provider_receipt_correlation279','owner_recovery_access_audit279',
  'isolated_restore_evidence279'
 ] loop
  if to_regclass('icamp_private.'||tab) is null
   then raise exception 'Build 279 private table missing %',tab;end if;
  if not exists(
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where c.relname=tab and n.nspname='icamp_private'
    and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'Build 279 FORCE RLS missing %',tab;end if;
  if not exists(
   select 1 from pg_trigger t where
    t.tgrelid=to_regclass('icamp_private.'||tab)
    and t.tgenabled='O' and not t.tgisinternal
  ) then raise exception 'Build 279 append-only review trigger missing %',tab;end if;
  if not exists(
   select 1 from pg_constraint c where c.conrelid=to_regclass('icamp_private.'||tab)
    and c.contype='u'
  ) then raise exception 'Build 279 duplicate review prevention missing %',tab;end if;
 end loop;
end $$;
