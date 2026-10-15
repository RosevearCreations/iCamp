# Build 045 — Cancellation, Refund & Adjustment Safeguards

Status: **FULLY PROMOTED — `main` GREEN.**

## Scope

Build 045 closes the financial-review boundary deliberately left by Build 044.

Delivered scope:

- campground-configurable cancellation/refund policy engine;
- early/late cancellation refund percentages;
- separately configurable refundable security-deposit percentage;
- cancellation fee;
- refund approval threshold;
- partial and full original-payment-linked refund requests;
- cancellation refund requests driven by policy recommendations;
- prevention of refunding more than the captured, unreserved payment amount;
- mandatory approval for refunds above policy or threshold;
- requester/approver separation for approval-required refunds;
- provider-neutral refund execution with a free mock adapter;
- private normalized refund-provider event evidence;
- append-only financial adjustment evidence;
- explicit zero-refund cancellation forfeit/review resolution;
- Web/PWA financial safeguard workspace with IVR/DTMF and SMS/MMS safe fallbacks.

## Evidence boundaries

Build 045 does not rewrite:

- the Build 041 accepted checkout quote;
- the Build 042 payment schedule or captured payment row;
- Build 043 confirmations, invoices or receipts;
- Build 044 reservation change history.

Refund and adjustment records are new evidence linked back to those immutable sources.

## Cancellation/refund policy

Each campground may configure:

- currency;
- free-cancellation cutoff in days before arrival;
- refund percentage before the cutoff;
- refund percentage after the cutoff;
- refundable security-deposit percentage;
- fixed cancellation fee;
- approval threshold.

When no policy has been persisted, the safe development default is:

- CAD;
- 7-day cutoff;
- 100% ordinary refund before cutoff;
- 0% ordinary refund after cutoff;
- 100% refundable security deposit;
- no cancellation fee;
- CAD 250 approval threshold.

The policy is snapshotted into each refund request so later policy changes do not rewrite the decision evidence.

## Policy recommendation

For a cancelled reservation, Build 045:

1. reads captured Build 042 payments;
2. subtracts amounts already succeeded or reserved by active refund work;
3. applies the early/late refund percentage to ordinary captured payments;
4. applies the security-deposit percentage separately;
5. applies the cancellation fee only against ordinary refundable amounts;
6. produces per-original-payment allocations plus aggregate refund/retained totals.

The calculation never increases the refundable amount beyond the unrefunded captured amount.

## Partial and full refunds

Every refund row links to exactly one original captured `reservation_payments` row.

Safeguards:

- a partial refund may not exceed the remaining captured amount;
- a `full` refund must equal the entire remaining captured amount for that original payment;
- cancellation refunds require the canonical reservation to be cancelled;
- refund policy currency must match the original payment currency;
- active/pending/succeeded refunds reserve capacity so duplicate requests cannot over-refund the payment;
- idempotency keys prevent duplicate refund creation;
- failed/rejected refunds release the reserved capacity.

## Approval thresholds and policy overrides

A refund requires a separate finance approval when either:

- the refund/batch amount exceeds the campground approval threshold; or
- the requested amount exceeds the current policy recommendation for that original payment.

Approval-required refunds start in `pending_approval`.

The requester cannot approve their own approval-required refund.

A user with `finance.manage` may approve or reject; provider execution still requires the refund execution permission.

Below-threshold refunds that remain within policy are marked `approved` automatically, but provider execution is still a distinct action.

## Provider execution

The refund provider boundary is separate from the Build 042 capture adapter while reusing the same provider selection key.

The built-in `mock` adapter is free and returns deterministic refund evidence without collecting or storing payment credentials.

A provider execution requires:

- approved refund state;
- original payment still captured;
- original provider payment reference;
- amount/currency match;
- provider idempotency key.

Successful execution records:

- provider refund reference;
- private normalized provider event;
- succeeded refund state;
- append-only `refund` financial adjustment linked to both refund and original payment;
- audit evidence.

External provider credentials or a paid account are not required for Build 045.

## Financial adjustments

`public.reservation_financial_adjustments` is append-only.

Supported non-refund evidence kinds:

- credit;
- charge;
- forfeit;
- write-off.

Refund execution adds a `refund` adjustment automatically.

The adjustment ledger stores the financial effect, amount/currency, reason, actor and evidence references without modifying the historical quote/payment/document rows.

## Zero-refund cancellation

If a cancelled reservation has captured money but the active cancellation policy recommends zero remaining refund:

- pending refund work must be resolved first;
- finance may record the remaining amount as a policy forfeit;
- the append-only forfeit evidence snapshots the applied policy;
- the Build 044 current financial-review flag may then be cleared at the trusted server boundary.

If the policy still recommends a refund, the forfeit shortcut is rejected.

## Authorization

- policy review: finance/payment/refund/configuration viewers as authorized;
- policy management: `finance.manage` or campground configuration authority;
- refund request/execution: `refund.issue`;
- approval/rejection and non-refund adjustment evidence: `finance.manage`;
- financial evidence read: payment/refund/finance roles.

All Build 045 public tables FORCE RLS.

The private provider-event ledger is not accessible through `icamp_app`.

## Channel parity

- **Web/PWA:** full policy configuration, refund recommendation, partial/full request, approval/rejection, provider execution and adjustment history.
- **IVR/DTMF:** verified staff may hear refund/policy status; high-risk approval/execution uses staff-assisted or secure visual fallback. No payment credentials are collected.
- **SMS/MMS:** concise status plus secure-link handoff. Unverified message content cannot approve or execute refunds.
- **Staff-assisted:** uses the same canonical policy, approval and provider commands.

No channel can bypass campground authorization, approval thresholds, requester/approver separation, original-payment linkage or provider idempotency.

## Cost and portability

No new paid provider, hosting project, Worker, D1 database, R2 bucket or external financial service is introduced.

Build 045 uses the existing PostgreSQL database, Next.js application, authorization/audit layers and free mock provider.

## Build boundaries

Build 045 does not add walk-up/overflow/office reservation intake; that remains Build 046.

It also does not implement a general accounting ledger or POS refund domain. Later finance/POS builds may consume the append-only Build 045 evidence without rewriting it.


## Promotion evidence

- feature PR #175 merged exact GREEN head `46c59cca66ee8dcef54ed4362e0137d405762c00` into `dev`;
- exact post-merge `dev` SHA `6ec3641c76c18db4f0635ef90448734b292c12b5` independently passed CI, Browser E2E, Database lifecycle/idempotence, CodeQL and Secret Scan;
- hosted Supabase migration `20261015124028 / cancellation_refund_adjustment_safeguards` applied successfully;
- hosted Build 045 verification contract passed;
- Supabase Security Advisor returned zero findings;
- Supabase Performance Advisor returned no Build-045 WARN findings; only the existing `unused_index` INFO class remained;
- production PR #176 merged exact GREEN `dev` into `main`;
- runtime production `main` SHA `7139df61f69f6c4e1466edd57830236db6642c99` independently passed CI, Browser E2E, Database lifecycle/idempotence, CodeQL and Secret Scan;
- no paid provider, new hosting project or manual owner action was required.
