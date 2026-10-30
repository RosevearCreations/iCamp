-- Build 160: private, unseeded approval-event ledger for future authenticated legal review.
-- It does not authorize a provider, publish documents, or grant a write policy.
create table icamp_private.subscriber_agreement_review_events (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references icamp_private.subscriber_document_versions(id) on delete restrict,
  sequence_no integer not null check (sequence_no > 0),
  action text not null check (action in ('submit', 'review', 'approve', 'reject', 'request_changes')),
  actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_reference text not null check (length(evidence_reference) between 8 and 200),
  occurred_at timestamptz not null default statement_timestamp(),
  unique (document_version_id, sequence_no)
);

create function icamp_private.build160_lock_document_identity() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if new.document_type is distinct from old.document_type
    or new.version_label is distinct from old.version_label
    or new.content_sha256 is distinct from old.content_sha256 then
    raise exception 'Registered document version and digest are immutable';
  end if;
  return new;
end $$;
create trigger build160_document_version_identity_guard before update
  on icamp_private.subscriber_document_versions for each row
  execute function icamp_private.build160_lock_document_identity();

create function icamp_private.build160_validate_agreement_review_event() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare latest_action text; latest_actor uuid; submit_actor uuid; review_actor uuid;
declare latest_sequence integer; registered_digest text;
begin
  -- Lock the source version to serialize simultaneous review attempts.
  select content_sha256 into registered_digest
    from icamp_private.subscriber_document_versions
    where id = new.document_version_id for update;
  if registered_digest is distinct from new.content_sha256 then
    raise exception 'Agreement review evidence must match the registered document digest';
  end if;
  select sequence_no, action, actor_user_id into latest_sequence, latest_action, latest_actor
    from icamp_private.subscriber_agreement_review_events
    where document_version_id = new.document_version_id order by sequence_no desc limit 1;
  if new.sequence_no <> coalesce(latest_sequence, 0) + 1 then
    raise exception 'Agreement review sequence must be consecutive';
  end if;
  if latest_action is null and new.action <> 'submit' then
    raise exception 'Agreement review must begin with submit';
  elsif latest_action = 'submit' and new.action not in ('review', 'request_changes') then
    raise exception 'Submitted agreement requires independent review';
  elsif latest_action = 'review' and new.action not in ('approve', 'reject') then
    raise exception 'Reviewed agreement requires approval or rejection';
  elsif latest_action in ('approve', 'reject') then
    raise exception 'Agreement review is terminal; register a new version';
  elsif latest_action = 'request_changes' and new.action <> 'submit' then
    raise exception 'Revised agreement must be resubmitted';
  end if;
  if new.action = 'review' and new.actor_user_id = latest_actor then
    raise exception 'Submitter cannot independently review the same agreement';
  end if;
  if new.action = 'approve' then
    select actor_user_id into submit_actor from icamp_private.subscriber_agreement_review_events
      where document_version_id = new.document_version_id and action = 'submit'
      order by sequence_no desc limit 1;
    review_actor := latest_actor;
    if new.actor_user_id in (submit_actor, review_actor) then
      raise exception 'Approver must be distinct from submitter and reviewer';
    end if;
  end if;
  return new;
end $$;

create trigger build160_review_event_sequence_guard before insert
  on icamp_private.subscriber_agreement_review_events for each row
  execute function icamp_private.build160_validate_agreement_review_event();

create trigger build160_no_review_event_rewrite before update or delete
  on icamp_private.subscriber_agreement_review_events for each row
  execute function icamp_private.build159_immutable_consent_receipts();

alter table icamp_private.subscriber_agreement_review_events enable row level security;
alter table icamp_private.subscriber_agreement_review_events force row level security;
revoke all on icamp_private.subscriber_agreement_review_events from public;
revoke all on function icamp_private.build160_validate_agreement_review_event() from public;
revoke all on function icamp_private.build160_lock_document_identity() from public;
comment on table icamp_private.subscriber_agreement_review_events is
  'Private append-only versioned legal review events; no rows seeded, no app policies, no commercial authorization.';
