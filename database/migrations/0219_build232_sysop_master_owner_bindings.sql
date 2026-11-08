-- iCamp Build 232: explicit Ree/Jack master-owner binding is a second,
-- independent prerequisite for the platform Sysop shell.
-- No identity is inferred from an email, a Comms Hub membership, or a tenant role.
create table icamp_private.platform_master_owner_bindings (
  user_id uuid primary key
    references icamp_private.user_accounts(id) on delete restrict,
  owner_slot text not null unique
    check (owner_slot in ('ree', 'jack')),
  binding_state text not null default 'pending'
    check (binding_state in ('pending', 'verified', 'revoked')),
  verified_at timestamptz,
  verified_by uuid references icamp_private.user_accounts(id),
  verification_reference text,
  created_at timestamptz not null default statement_timestamp(),
  constraint platform_master_owner_binding_verification_requires_review
    check (
      binding_state <> 'verified'
      or (
        verified_at is not null
        and verified_by is not null
        and verified_by <> user_id
        and nullif(trim(verification_reference), '') is not null
      )
    )
);

alter table icamp_private.platform_master_owner_bindings enable row level security;
alter table icamp_private.platform_master_owner_bindings force row level security;
revoke all on icamp_private.platform_master_owner_bindings from public;
do $icamp$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on icamp_private.platform_master_owner_bindings from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on icamp_private.platform_master_owner_bindings from authenticated;
  end if;
end
$icamp$;

comment on table icamp_private.platform_master_owner_bindings is
  'At most two independently verified platform owner slots (Ree and Jack). Requires a separately active operator grant, an active staff account and verified MFA. Never seeded or self-activated by the application.';
