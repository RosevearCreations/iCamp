-- iCamp Build 052 verification
-- Stay Extension & Accommodation Move.

do $verify_build052$
declare
  rls_enabled boolean;
  rls_forced boolean;
begin
  if to_regclass('public.reservation_stay_adjustments') is null then
    raise exception 'Build 052 reservation_stay_adjustments table is missing';
  end if;

  select c.relrowsecurity,c.relforcerowsecurity
    into rls_enabled,rls_forced
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname='reservation_stay_adjustments';

  if not coalesce(rls_enabled,false) or not coalesce(rls_forced,false) then
    raise exception 'Build 052 stay-adjustment RLS must remain enabled and forced';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.reservation_stay_adjustments'::regclass
      and tgname='reservation_stay_adjustments_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 052 stay-adjustment evidence must remain append-only';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='reservation_stay_adjustments'
      and policyname='reservation_stay_adjustments_insert'
      and cmd='INSERT'
  ) then
    raise exception 'Build 052 reservation.modify insert boundary is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='reservation_stay_adjustments'
      and indexname='reservation_stay_adjustments_reservation_idx'
  ) then
    raise exception 'Build 052 reservation lookup index is missing';
  end if;

  if exists(select 1 from pg_roles where rolname='anon')
     and has_table_privilege('anon','public.reservation_stay_adjustments','SELECT') then
    raise exception 'Build 052 anon direct stay-adjustment access must remain denied';
  end if;

  if exists(select 1 from pg_roles where rolname='authenticated')
     and has_table_privilege('authenticated','public.reservation_stay_adjustments','SELECT') then
    raise exception 'Build 052 authenticated direct stay-adjustment access must remain denied';
  end if;
end
$verify_build052$;
