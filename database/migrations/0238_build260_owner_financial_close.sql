-- iCamp Build 260: owner decision over separately verified financial evidence.
-- A non-posting review receipt, NOT a money transfer, tax filing or bank/book close.
create table public.icamp_finance_close260 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  local_day date not null,
  source_digest_sha256 text not null check (source_digest_sha256 ~ '^[a-f0-9]{64}$'),
  settlement_digest_sha256 text not null check (settlement_digest_sha256 ~ '^[a-f0-9]{64}$'),
  tax_digest_sha256 text not null check (tax_digest_sha256 ~ '^[a-f0-9]{64}$'),
  accounting_digest_sha256 text not null check (accounting_digest_sha256 ~ '^[a-f0-9]{64}$'),
  package_digest_sha256 text not null check (package_digest_sha256 ~ '^[a-f0-9]{64}$'),
  signer_key_id text not null check (char_length(signer_key_id) between 1 and 120),
  statement_id text not null check (char_length(statement_id) between 1 and 240),
  reason text not null check (char_length(trim(reason)) between 20 and 700),
  disposition text not null default 'owner_approved_evidence_packet_nonposting'
    check (disposition='owner_approved_evidence_packet_nonposting'),
  approved_by_user_id uuid not null references icamp_private.user_accounts(id),
  approved_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  unique (campground_id,local_day)
);
create index icamp_finance_close260_recent_idx
  on public.icamp_finance_close260 (campground_id,approved_at desc,id desc);

create function icamp_private.guard_owner_finance_close260()
returns trigger language plpgsql security definer set search_path='' as $$
declare active_org uuid;
begin
  if new.approved_by_user_id is distinct from
       nullif(current_setting('icamp.user_id',true),'')::uuid
    or not icamp_private.has_current_campground_owner_admin(new.campground_id)
    or not icamp_private.has_campground_permission(new.campground_id,'finance.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
  then raise exception 'Current independent campground owner with finance and staff management required'; end if;
  select c.organization_id into active_org from public.campgrounds c
    where c.id=new.campground_id and c.lifecycle_state='active';
  if active_org is null or active_org is distinct from new.organization_id
  then raise exception 'Active, matching campground required'; end if;
  if new.local_day > (statement_timestamp() at time zone 'UTC')::date
    or new.local_day < (statement_timestamp() at time zone 'UTC')::date - 31
  then raise exception 'Owner review day must be within the past 31 UTC days'; end if;
  new.disposition:='owner_approved_evidence_packet_nonposting';
  new.approved_at:=statement_timestamp();
  return new;
end;
$$;
create trigger icamp_finance_close260_guard
before insert on public.icamp_finance_close260
for each row execute function icamp_private.guard_owner_finance_close260();

alter table public.icamp_finance_close260 enable row level security;
alter table public.icamp_finance_close260 force row level security;
revoke all on public.icamp_finance_close260 from public;
do $direct_roles$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.icamp_finance_close260 from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.icamp_finance_close260 from authenticated;
  end if;
end $direct_roles$;
grant select,insert on public.icamp_finance_close260 to icamp_app;
create policy icamp_finance_close260_read
  on public.icamp_finance_close260 for select to icamp_app
  using (
    icamp_private.has_current_campground_owner_admin(campground_id)
    and icamp_private.has_campground_permission(campground_id,'finance.manage')
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
  );
create policy icamp_finance_close260_insert
  on public.icamp_finance_close260 for insert to icamp_app
  with check (
    approved_by_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
    and icamp_private.has_current_campground_owner_admin(campground_id)
    and icamp_private.has_campground_permission(campground_id,'finance.manage')
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
  );
comment on table public.icamp_finance_close260 is
 'Immutable owner approval of an inspected financial evidence packet only; no bank clearing, HST filing, accounting journal or monetary posting.';
