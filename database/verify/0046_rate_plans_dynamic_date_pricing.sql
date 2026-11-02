-- iCamp Build 039 verification.
do $verify$
begin
  if to_regclass('public.rate_plans') is null then raise exception 'rate_plans missing'; end if;
  if to_regclass('public.rate_rules') is null then raise exception 'rate_rules missing'; end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='rate_plans' and c.relforcerowsecurity
  ) then raise exception 'rate_plans must FORCE RLS'; end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='rate_rules' and c.relforcerowsecurity
  ) then raise exception 'rate_rules must FORCE RLS'; end if;
  if has_table_privilege('icamp_app','public.rate_plans','DELETE') then
    raise exception 'rate_plans must not be deletable by icamp_app';
  end if;
  if has_table_privilege('icamp_app','public.rate_rules','DELETE') then
    raise exception 'rate_rules must not be deletable by icamp_app';
  end if;
end
$verify$;
