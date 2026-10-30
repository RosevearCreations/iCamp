-- Build 159: fail-closed storage foundation only, not commercial authorization.
-- No legal documents, provider credentials, subscribers or acceptance events are seeded.
create table icamp_private.subscriber_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('subscriber_terms', 'privacy_notice')),
  version_label text not null check (version_label ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$'),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  approval_state text not null default 'draft'
    check (approval_state in ('draft', 'reviewed', 'published')),
  reviewed_by uuid references icamp_private.user_accounts(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (document_type, version_label),
  constraint subscriber_document_publication_review_check check (
    approval_state = 'draft'
    or (reviewed_by is not null and reviewed_at is not null and
      (approval_state <> 'published' or published_at is not null))
  )
);

create table icamp_private.subscriber_consent_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  subscriber_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
  terms_document_id uuid not null references icamp_private.subscriber_document_versions(id) on delete restrict,
  privacy_document_id uuid not null references icamp_private.subscriber_document_versions(id) on delete restrict,
  explicit_acceptance boolean not null check (explicit_acceptance = true),
  accepted_at timestamptz not null,
  receipt_sha256 text not null check (receipt_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz not null default statement_timestamp(),
  unique (organization_id, subscriber_user_id, receipt_sha256),
  check (accepted_at <= recorded_at)
);

create function icamp_private.build159_validate_consent_documents() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare terms_state text; privacy_state text;
begin
  select approval_state into terms_state
    from icamp_private.subscriber_document_versions
    where id = new.terms_document_id and document_type = 'subscriber_terms';
  select approval_state into privacy_state
    from icamp_private.subscriber_document_versions
    where id = new.privacy_document_id and document_type = 'privacy_notice';
  if terms_state is distinct from 'published' or privacy_state is distinct from 'published' then
    raise exception 'Subscriber acceptance requires independently reviewed published document versions';
  end if;
  return new;
end $$;

create trigger build159_consent_published_documents_guard
  before insert on icamp_private.subscriber_consent_receipts
  for each row execute function icamp_private.build159_validate_consent_documents();

create function icamp_private.build159_immutable_consent_receipts() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Subscriber consent receipts are append-only';
end $$;

create trigger build159_no_consent_rewrite
  before update or delete on icamp_private.subscriber_consent_receipts
  for each row execute function icamp_private.build159_immutable_consent_receipts();

alter table icamp_private.subscriber_document_versions enable row level security;
alter table icamp_private.subscriber_document_versions force row level security;
alter table icamp_private.subscriber_consent_receipts enable row level security;
alter table icamp_private.subscriber_consent_receipts force row level security;
revoke all on icamp_private.subscriber_document_versions from public;
revoke all on icamp_private.subscriber_consent_receipts from public;
revoke all on function icamp_private.build159_validate_consent_documents() from public;
revoke all on function icamp_private.build159_immutable_consent_receipts() from public;

comment on table icamp_private.subscriber_document_versions is
  'Inactive document version registry pending reviewed Canadian terms and privacy content. No public write policies.';
comment on table icamp_private.subscriber_consent_receipts is
  'Inactive append-only subscriber consent receipt schema. No public or app write policies; future authenticated service workflow and independent approvals required.';
