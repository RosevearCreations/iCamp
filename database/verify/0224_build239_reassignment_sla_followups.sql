-- Build 239 verifies irreversible worker changes and supervisor-only reviews.
do $verify239$ begin
  if not exists (
    select 1 from pg_class where oid = 'public.service_fulfillment_assignment_transitions'::regclass
      and relrowsecurity and relforcerowsecurity
  ) or not exists (
    select 1 from pg_class where oid = 'public.service_fulfillment_sla_followups'::regclass
      and relrowsecurity and relforcerowsecurity
  ) then raise exception 'Build 239 RLS missing'; end if;
  if (select count(*) from pg_policies where schemaname = 'public'
    and tablename = 'service_fulfillment_assignment_transitions') <> 1
    or (select count(*) from pg_policies where schemaname = 'public'
      and tablename = 'service_fulfillment_sla_followups') <> 2
  then raise exception 'Build 239 supervisor RLS policy count changed'; end if;
  if (select count(*) from pg_trigger where tgname in (
    'service_fulfillment_assignment_transition_history',
    'service_fulfillment_sla_followups_guard') and not tgisinternal) <> 2
  then raise exception 'Build 239 source-triggered audit guards missing'; end if;
  if has_table_privilege('icamp_app','public.service_fulfillment_assignment_transitions','INSERT')
    or has_table_privilege('icamp_app','public.service_fulfillment_assignment_transitions','UPDATE')
    or has_table_privilege('icamp_app','public.service_fulfillment_assignment_transitions','DELETE')
    or has_table_privilege('icamp_app','public.service_fulfillment_sla_followups','UPDATE')
    or has_table_privilege('icamp_app','public.service_fulfillment_sla_followups','DELETE')
  then raise exception 'Build 239 source history must be immutable'; end if;
  if exists (select 1 from pg_roles where rolname = 'anon') and (
    has_table_privilege('anon','public.service_fulfillment_assignment_transitions','SELECT')
    or has_table_privilege('anon','public.service_fulfillment_sla_followups','SELECT')
  ) then raise exception 'Build 239 evidence exposed to anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') and (
    has_table_privilege('authenticated','public.service_fulfillment_assignment_transitions','SELECT')
    or has_table_privilege('authenticated','public.service_fulfillment_sla_followups','SELECT')
  ) then raise exception 'Build 239 evidence exposed to generic authenticated'; end if;
end $verify239$;
