-- iCamp Build 055 verification.
do $verify$
declare
  policy_force_rls boolean;
  registration_force_rls boolean;
  event_force_rls boolean;
  payment_force_rls boolean;
begin
  if to_regclass('public.campground_visitor_policies') is null then
    raise exception 'campground_visitor_policies table is missing';
  end if;
  if to_regclass('public.visitor_registrations') is null then
    raise exception 'visitor_registrations table is missing';
  end if;
  if to_regclass('public.visitor_registration_events') is null then
    raise exception 'visitor_registration_events table is missing';
  end if;
  if to_regclass('public.visitor_registration_payments') is null then
    raise exception 'visitor_registration_payments table is missing';
  end if;
  if to_regclass('icamp_private.visitor_registration_payment_provider_events') is null then
    raise exception 'visitor_registration_payment_provider_events table is missing';
  end if;

  select c.relforcerowsecurity into policy_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='campground_visitor_policies';

  select c.relforcerowsecurity into registration_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='visitor_registrations';

  select c.relforcerowsecurity into event_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='visitor_registration_events';

  select c.relforcerowsecurity into payment_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='visitor_registration_payments';

  if policy_force_rls is distinct from true
    or registration_force_rls is distinct from true
    or event_force_rls is distinct from true
    or payment_force_rls is distinct from true then
    raise exception 'Build 055 public tables must FORCE RLS';
  end if;

  if has_table_privilege('icamp_app','public.visitor_registration_payments','INSERT')
    or has_table_privilege('icamp_app','public.visitor_registration_payments','UPDATE')
    or has_table_privilege('icamp_app','public.visitor_registration_payments','DELETE') then
    raise exception 'visitor registration payments must remain trusted-server write only';
  end if;

  if has_table_privilege('icamp_app','public.visitor_registration_events','UPDATE')
    or has_table_privilege('icamp_app','public.visitor_registration_events','DELETE') then
    raise exception 'visitor registration events must remain append-only';
  end if;

  if has_table_privilege(
    'icamp_app',
    'icamp_private.visitor_registration_payment_provider_events',
    'SELECT'
  ) then
    raise exception 'visitor registration provider events must remain private';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='icamp_private'
      and p.proname='resolve_visitor_limit'
  ) then
    raise exception 'site-specific visitor limit resolver is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='visitor_registrations'
      and indexname='visitor_registrations_accommodation_window_idx'
  ) then
    raise exception 'visitor overlap/capacity lookup index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='visitor_registration_payments'
      and indexname='visitor_registration_payments_scope_registration_fk_idx'
  ) then
    raise exception 'visitor payment composite foreign-key index is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='capacity_limit_rules'
      and policyname='capacity_limit_rules_read'
      and qual like '%visitor.register%'
  ) then
    raise exception 'visitor registrar must be able to resolve Build 033 visitor limits';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='booking_charge_catalog'
      and policyname='booking_charge_catalog_read'
      and qual like '%visitor.register%'
  ) then
    raise exception 'visitor registrar must be able to read canonical Build 040 charges';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='reservations'
      and policyname='reservations_read'
      and qual like '%visitor.register%'
  ) then
    raise exception 'visitor registrar must be able to read host reservation facts';
  end if;

  if not exists (
    select 1
    from icamp_private.role_permissions rp
    join icamp_private.roles r on r.id=rp.role_id
    where r.role_kind='template'
      and r.role_code='security'
      and rp.permission_key='visitor.register'
  ) then
    raise exception 'security template must receive visitor.register';
  end if;

  if not exists (
    select 1
    from icamp_private.role_permissions rp
    join icamp_private.roles r on r.id=rp.role_id
    where r.role_kind='template'
      and r.role_code='campground_manager'
      and rp.permission_key='visitor.register'
  ) then
    raise exception 'campground manager template must receive visitor.register';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.visitor_registrations','SELECT')
      or has_table_privilege('anon','public.visitor_registrations','INSERT')
      or has_table_privilege('anon','public.visitor_registration_payments','SELECT') then
      raise exception 'anon direct visitor-registration access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.visitor_registrations','SELECT')
      or has_table_privilege('authenticated','public.visitor_registrations','INSERT')
      or has_table_privilege('authenticated','public.visitor_registration_payments','SELECT') then
      raise exception 'authenticated direct visitor-registration access must remain denied';
    end if;
  end if;
end
$verify$;
