-- Checks migration shape in disposable CI, NOT original provider identity.
do $$
declare tab text;
begin
 foreach tab in array array[
  'external_provider_key_proposal280','external_provider_key_review280',
  'external_provider_signed_closure280','owner_recovery_witness280',
  'isolated_restore_certificate280'
 ] loop
  if to_regclass('icamp_private.'||tab) is null
   then raise exception 'Build 280 private table missing %',tab;end if;
  if not exists(
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where c.relname=tab and n.nspname='icamp_private'
    and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'Build 280 FORCE RLS missing %',tab;end if;
  if not exists(
   select 1 from pg_trigger t where t.tgrelid=to_regclass('icamp_private.'||tab)
    and not t.tgisinternal and t.tgenabled='O'
  ) then raise exception 'Build 280 immutable guard missing %',tab;end if;
  if not exists(
   select 1 from pg_constraint c where c.conrelid=to_regclass('icamp_private.'||tab)
    and c.contype='u'
  ) then raise exception 'Build 280 replay/uniqueness guard missing %',tab;end if;
 end loop;
end $$;
