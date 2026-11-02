-- iCamp Build 045
-- Cancellation, Refund & Adjustment Safeguards.

create table public.campground_cancellation_refund_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  currency_code text not null default 'CAD'
    check (currency_code ~ '^[A-Z]{3}$'),
  free_cancellation_days_before_arrival smallint not null default 7
    check (free_cancellation_days_before_arrival between 0 and 365),
  early_refund_basis_points integer not null default 10000
    check (early_refund_basis_points between 0 and 10000),
  late_refund_basis_points integer not null default 0
    check (late_refund_basis_points between 0 and 10000),
  security_deposit_refund_basis_points integer not null default 10000
    check (security_deposit_refund_basis_points between 0 and 10000),
  cancellation_fee_cents integer not null default 0
    check (cancellation_fee_cents between 0 and 100000000),
  approval_threshold_cents integer not null default 25000
    check (approval_threshold_cents between 0 and 100000000),
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_cancellation_refund_policies_scope_unique
    unique (organization_id, campground_id),
  constraint campground_cancellation_refund_policies_campground_unique
    unique (campground_id),
  constraint campground_cancellation_refund_policies_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict
);

create trigger campground_cancellation_refund_policies_touch_row
before update on public.campground_cancellation_refund_policies
for each row execute function icamp_private.touch_row();

create index campground_cancellation_refund_policies_updated_by_idx
  on public.campground_cancellation_refund_policies (updated_by_user_id)
  where updated_by_user_id is not null;

create table public.reservation_refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  original_payment_id uuid not null
    references public.reservation_payments(id)
    on update cascade
    on delete restrict,
  policy_id uuid
    references public.campground_cancellation_refund_policies(id)
    on update cascade
    on delete restrict,
  requested_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  approved_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  refund_kind text not null
    check (refund_kind in ('partial','full','cancellation')),
  amount_cents integer not null
    check (amount_cents between 1 and 200000000),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  reason text not null
    check (char_length(trim(reason)) between 3 and 1000),
  policy_snapshot jsonb not null
    check (jsonb_typeof(policy_snapshot) = 'object'),
  approval_required boolean not null default false,
  approval_state text not null default 'pending'
    check (approval_state in ('not_required','pending','approved','rejected')),
  refund_state text not null default 'pending_approval'
    check (
      refund_state in (
        'pending_approval',
        'approved',
        'submitted',
        'succeeded',
        'failed',
        'rejected'
      )
    ),
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_refund_reference text,
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 16 and 240),
  last_error_code text,
  requested_at timestamptz not null default statement_timestamp(),
  approved_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint reservation_refunds_idempotency_unique
    unique (campground_id, idempotency_key),
  constraint reservation_refunds_provider_reference_unique
    unique (provider_key, provider_refund_reference),
  constraint reservation_refunds_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint reservation_refunds_approval_shape_check
    check (
      (approval_required and approval_state in ('pending','approved','rejected'))
      or
      (not approval_required and approval_state = 'not_required')
    ),
  constraint reservation_refunds_state_shape_check
    check (
      (refund_state = 'pending_approval' and approval_state = 'pending')
      or
      (refund_state in ('approved','submitted','succeeded','failed')
        and approval_state in ('not_required','approved'))
      or
      (refund_state = 'rejected' and approval_state = 'rejected')
    )
);

create trigger reservation_refunds_touch_row
before update on public.reservation_refunds
for each row execute function icamp_private.touch_row();

create index reservation_refunds_scope_fk_idx
  on public.reservation_refunds (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_refunds_original_payment_fk_idx
  on public.reservation_refunds (original_payment_id);

create index reservation_refunds_policy_fk_idx
  on public.reservation_refunds (policy_id)
  where policy_id is not null;

create index reservation_refunds_requested_by_fk_idx
  on public.reservation_refunds (requested_by_user_id);

create index reservation_refunds_approved_by_fk_idx
  on public.reservation_refunds (approved_by_user_id)
  where approved_by_user_id is not null;

create index reservation_refunds_review_queue_idx
  on public.reservation_refunds (
    campground_id,
    approval_state,
    refund_state,
    requested_at
  );

create table public.reservation_financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  refund_id uuid
    references public.reservation_refunds(id)
    on update cascade
    on delete restrict,
  original_payment_id uuid
    references public.reservation_payments(id)
    on update cascade
    on delete restrict,
  adjustment_kind text not null
    check (
      adjustment_kind in (
        'refund',
        'credit',
        'charge',
        'forfeit',
        'writeoff',
        'review_resolution'
      )
    ),
  financial_effect text not null
    check (
      financial_effect in (
        'customer_credit',
        'customer_debit',
        'retained',
        'none'
      )
    ),
  amount_cents integer not null
    check (amount_cents between 0 and 200000000),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  reason text not null
    check (char_length(trim(reason)) between 3 and 1000),
  evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence) = 'object'),
  actor_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 16 and 240),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint reservation_financial_adjustments_idempotency_unique
    unique (campground_id, idempotency_key),
  constraint reservation_financial_adjustments_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint reservation_financial_adjustments_amount_shape_check
    check (
      amount_cents > 0
      or adjustment_kind = 'review_resolution'
    )
);

create index reservation_financial_adjustments_scope_fk_idx
  on public.reservation_financial_adjustments (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_financial_adjustments_refund_fk_idx
  on public.reservation_financial_adjustments (refund_id)
  where refund_id is not null;

create index reservation_financial_adjustments_original_payment_fk_idx
  on public.reservation_financial_adjustments (original_payment_id)
  where original_payment_id is not null;

create index reservation_financial_adjustments_actor_fk_idx
  on public.reservation_financial_adjustments (actor_user_id);

create or replace function icamp_private.guard_reservation_financial_adjustments()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Reservation financial adjustments are append-only';
end;
$$;

create trigger reservation_financial_adjustments_append_only
before update or delete on public.reservation_financial_adjustments
for each row execute function icamp_private.guard_reservation_financial_adjustments();

create table icamp_private.refund_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_event_id text not null
    check (char_length(trim(provider_event_id)) between 1 and 240),
  refund_id uuid not null
    references public.reservation_refunds(id)
    on update cascade
    on delete restrict,
  event_type text not null
    check (event_type in ('refund.submitted','refund.succeeded','refund.failed')),
  event_status text not null
    check (char_length(trim(event_status)) between 1 and 120),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  constraint refund_provider_events_provider_event_unique
    unique (provider_key, provider_event_id)
);

create index refund_provider_events_refund_time_idx
  on icamp_private.refund_provider_events (refund_id, occurred_at desc);

alter table public.campground_cancellation_refund_policies enable row level security;
alter table public.campground_cancellation_refund_policies force row level security;
alter table public.reservation_refunds enable row level security;
alter table public.reservation_refunds force row level security;
alter table public.reservation_financial_adjustments enable row level security;
alter table public.reservation_financial_adjustments force row level security;

revoke all on
  public.campground_cancellation_refund_policies,
  public.reservation_refunds,
  public.reservation_financial_adjustments
from public;

revoke all on icamp_private.refund_provider_events from public;

do $build045_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.campground_cancellation_refund_policies, public.reservation_refunds, public.reservation_financial_adjustments from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.campground_cancellation_refund_policies, public.reservation_refunds, public.reservation_financial_adjustments from authenticated';
  end if;
end
$build045_direct_roles$;

grant select, insert, update
  on public.campground_cancellation_refund_policies
  to icamp_app;

grant select, insert, update
  on public.reservation_refunds
  to icamp_app;

grant select, insert
  on public.reservation_financial_adjustments
  to icamp_app;

create policy campground_cancellation_refund_policies_read
on public.campground_cancellation_refund_policies
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'finance.read')
  or icamp_private.has_campground_permission(campground_id, 'finance.manage')
  or icamp_private.has_campground_permission(campground_id, 'refund.issue')
  or icamp_private.has_campground_permission(campground_id, 'campground.configuration')
);

create policy campground_cancellation_refund_policies_insert
on public.campground_cancellation_refund_policies
for insert
to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id, 'finance.manage')
    or icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  )
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy campground_cancellation_refund_policies_update
on public.campground_cancellation_refund_policies
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'finance.manage')
  or icamp_private.has_campground_permission(campground_id, 'campground.configuration')
)
with check (
  (
    icamp_private.has_campground_permission(campground_id, 'finance.manage')
    or icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  )
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy reservation_refunds_read
on public.reservation_refunds
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'payment.read')
  or icamp_private.has_campground_permission(campground_id, 'refund.issue')
  or icamp_private.has_campground_permission(campground_id, 'finance.read')
  or icamp_private.has_campground_permission(campground_id, 'finance.manage')
);

create policy reservation_refunds_insert
on public.reservation_refunds
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'refund.issue')
  and requested_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy reservation_refunds_update
on public.reservation_refunds
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'refund.issue')
  or icamp_private.has_campground_permission(campground_id, 'finance.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'refund.issue')
  or icamp_private.has_campground_permission(campground_id, 'finance.manage')
);

create policy reservation_financial_adjustments_read
on public.reservation_financial_adjustments
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'payment.read')
  or icamp_private.has_campground_permission(campground_id, 'refund.issue')
  or icamp_private.has_campground_permission(campground_id, 'finance.read')
  or icamp_private.has_campground_permission(campground_id, 'finance.manage')
);

create policy reservation_financial_adjustments_insert
on public.reservation_financial_adjustments
for insert
to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id, 'refund.issue')
    or icamp_private.has_campground_permission(campground_id, 'finance.manage')
  )
  and actor_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on table public.campground_cancellation_refund_policies is
  'Build 045 campground cancellation/refund policy and approval threshold. Reservation payment schedules remain immutable.';
comment on table public.reservation_refunds is
  'Build 045 refund requests linked to the original captured Build 042 payment, with policy/approval/provider state.';
comment on table public.reservation_financial_adjustments is
  'Build 045 append-only financial adjustment evidence. Earlier quote, payment, receipt and reservation-change evidence is never rewritten.';
comment on table icamp_private.refund_provider_events is
  'Build 045 private normalized refund-provider event evidence; raw provider payloads and payment credentials are excluded.';
