import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  listAssignedCampgrounds,
  hasCampgroundPermission,
} from "@/lib/authz/postgres.mjs";
import {
  diagnoseCampgroundBooking268,
  listLocalBookingRecovery268,
} from "@/lib/campground-support268/postgres.mjs";
import {
  openBookingRecovery268Action,
  recordBookingRecovery268Action,
} from "./actions";
import { recordBookingWitness269Action } from "./actions269";
import { compareOriginalPayment270Action } from "./actions270";
import { certifyBooking271Action } from "./actions271";
import { recordProviderBooking272Action } from "./actions272";
import { tenantConsumerStatus273 } from "@/lib/build273/postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Booking confirmation recovery · iCamp",
  robots: { index: false, follow: false },
};
export default async function BookingRecovery268Page({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    reservation?: string;
    saved?: string;
    error?: string;
    provider270?: string;
    closure271?: string;
    field272?: string;
  }>;
}) {
  const path = "/workspaces/management/campgrounds/booking-recovery268";
  const session = await requireAnyCampgroundPermission(
    "campground.operations.manage",
    path,
  );
  const all = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      all.map(async (c) =>
        (await hasCampgroundPermission(
          session.user.id,
          c.campgroundId,
          "campground.operations.manage",
        ))
          ? c
          : null,
      ),
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);
  const params = await searchParams;
  const selected =
    allowed.find((x) => x.campgroundId === params.campground) ?? allowed[0];
  const evidence =
    selected && params.reservation
      ? await diagnoseCampgroundBooking268({
          userId: session.user.id,
          campgroundId: selected.campgroundId,
          reservationId: params.reservation,
        })
      : null;
  const cases = selected
    ? await listLocalBookingRecovery268({
        userId: session.user.id,
        campgroundId: selected.campgroundId,
      })
    : null;
  const consumer273 = selected
    ? await tenantConsumerStatus273({userId:session.user.id,
       campgroundId:selected.campgroundId})
    : null;
  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Build 268 · tenant-private service recovery</p>
          <h1>Paid but no confirmation: booking investigation</h1>
          <p className="hero-panel__lead">
            Campground staff investigate their own reservation, provider payment
            receipts, confirmation and delivery. Platform Sysop only sees
            redacted stage counts. This screen never charges, refunds, changes
            site availability, or sends mail automatically.
          </p>
        </section>
        <section className="content-panel">
          <h2>Open a campground-scoped booking</h2>
          <form method="get">
            <label>
              Assigned campground
              <select name="campground" defaultValue={selected?.campgroundId}>
                {allowed.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reservation UUID
              <input
                name="reservation"
                required
                maxLength={36}
                pattern="[a-fA-F0-9-]{36}"
                defaultValue={params.reservation ?? ""}
                placeholder="Original reservation reference"
              />
            </label>
            <button type="submit">Inspect original evidence</button>
          </form>
        </section>

        {params.saved ? (
          <p role="status">Original case action was recorded.</p>
        ) : null}
        {params.error ? (
          <p role="alert">
            Case action was not saved. Check permissions, original source
            readiness, version and references.
          </p>
        ) : null}
        <section className="content-panel">
          <h2>Open a local guest recovery case</h2>
          <p>
            Create the guest complaint in the original local support centre
            first. Link it to this campground&apos;s reservation. A recovery
            case does not change the payment or site and cannot be opened for
            another campground.
          </p>
          <form action={openBookingRecovery268Action}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected?.campgroundId ?? ""}
            />
            <label>
              Original reservation UUID
              <input
                name="reservationId"
                required
                maxLength={36}
                defaultValue={params.reservation ?? ""}
              />
            </label>
            <label>
              Existing local support case UUID
              <input name="caseId" required maxLength={36} />
            </label>
            <button type="submit">
              Open tracked recovery (follow-up due in 1 hour)
            </button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Local recovery timeline and guest follow-up</h2>
          <p>
            Original records: {cases?.status ?? "NO_ASSIGNED_CAMPGROUND"}. Staff
            records are private and the platform Shell only gets summary counts.
          </p>
          {cases?.cases.map((c) => (
            <article className="health-card" key={c.id}>
              <p>
                <strong>{c.state}</strong> · {c.outcome} · next update{" "}
                {c.nextUpdateAt}
              </p>
              <p>
                Support case: {c.caseId} · reservation: {c.reservationId}
              </p>
              <form action={recordBookingRecovery268Action}>
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected?.campgroundId ?? ""}
                />
                <input type="hidden" name="recoveryId" value={c.id} />
                <input type="hidden" name="version" value={c.version} />
                <label>
                  Documented action
                  <select name="eventKind" defaultValue="provider_checked">
                    <option value="provider_checked">
                      Provider evidence checked
                    </option>
                    <option value="site_checked">
                      Site allocation checked
                    </option>
                    <option value="guest_contacted">Guest contacted</option>
                    <option value="closed">
                      Close after evidence and guest follow-up
                    </option>
                    <option value="reopened">Reopen previous case</option>
                  </select>
                </label>
                <label>
                  Original, private evidence reference
                  <input
                    name="evidenceReference"
                    required
                    minLength={12}
                    maxLength={160}
                  />
                </label>
                <label>
                  Resolution (only used when closing)
                  <select name="outcome" defaultValue="unresolved">
                    <option value="unresolved">Unresolved</option>
                    <option value="confirmed">
                      Original confirmation documented
                    </option>
                    <option value="authorized_refund">
                      Approved refund record (not bank payout)
                    </option>
                    <option value="no_payment">
                      Independently confirmed no payment
                    </option>
                  </select>
                </label>
                <button type="submit">Save case evidence</button>
              </form>
              <h3>Build 269 · supervised original guest recovery pilot</h3>
              <p>
                Store only a SHA-256 digest of original payment, site, delivery
                or guest acknowledgement evidence. The campground retains the
                private source document; this receipt does not itself prove
                provider settlement.
              </p>
              <form action={recordBookingWitness269Action}>
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected?.campgroundId ?? ""}
                />
                <input type="hidden" name="recoveryId" value={c.id} />
                <label>
                  Original evidence stage
                  <select name="stage" defaultValue="processor_settlement">
                    <option value="processor_settlement">
                      Independent processor settlement check
                    </option>
                    <option value="site_allocation">
                      Original site-night availability
                    </option>
                    <option value="confirmation_delivery">
                      Guest confirmation delivery
                    </option>
                    <option value="guest_ack">
                      Guest acknowledges recovery outcome
                    </option>
                  </select>
                </label>
                <label>
                  Original evidence SHA-256 (lowercase)
                  <input
                    name="evidenceDigestSha256"
                    required
                    pattern="[a-f0-9]{64}"
                    minLength={64}
                    maxLength={64}
                  />
                </label>
                <button type="submit">Record original witness assertion</button>
              </form>
              <h3>Build 270 · provider-side payment trace</h3>
              <p>
                Read-only TEST processor check. We compare the original payment
                reference, amount and currency with a separately enrolled
                provider. This does not refund, capture, or alter a reservation.
              </p>
              <form action={compareOriginalPayment270Action}>
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected?.campgroundId ?? ""}
                />
                <input type="hidden" name="recoveryId" value={c.id} />
                <label>
                  Original payment row UUID
                  <input
                    name="paymentId"
                    required
                    maxLength={36}
                    pattern="[a-fA-F0-9-]{36}"
                  />
                </label>
                <button type="submit">
                  Verify payment with original test provider
                </button>
              </form>
              <h3>Build 272 · original processor and guest chain</h3>
              <p>
                An independently authorized campground manager can cross-link
                one real original provider match with the processor settlement,
                site allocation, delivered confirmation and guest acknowledgment
                witness rows. All UUIDs must belong to this same campground and
                booking recovery. Evidence review does not capture a payment,
                issue a refund, send a guest message or change site inventory.
              </p>
              <form action={recordProviderBooking272Action}>
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected?.campgroundId ?? ""}
                />
                <input type="hidden" name="recoveryId" value={c.id} />
                <label>
                  Provider trace UUID (Build 270)
                  <input
                    name="traceId"
                    required
                    pattern="[a-fA-F0-9-]{36}"
                    maxLength={36}
                  />
                </label>
                <label>
                  Processor settlement witness UUID (Build 269)
                  <input
                    name="processorWitnessId"
                    required
                    pattern="[a-fA-F0-9-]{36}"
                    maxLength={36}
                  />
                </label>
                <label>
                  Site allocation witness UUID
                  <input
                    name="siteWitnessId"
                    required
                    pattern="[a-fA-F0-9-]{36}"
                    maxLength={36}
                  />
                </label>
                <label>
                  Delivered guest confirmation witness UUID
                  <input
                    name="deliveryWitnessId"
                    required
                    pattern="[a-fA-F0-9-]{36}"
                    maxLength={36}
                  />
                </label>
                <label>
                  Guest acknowledgment witness UUID
                  <input
                    name="guestWitnessId"
                    required
                    pattern="[a-fA-F0-9-]{36}"
                    maxLength={36}
                  />
                </label>
                <label>
                  Independent source evidence SHA-256
                  <input
                    name="evidenceDigest"
                    required
                    pattern="[a-f0-9]{64}"
                    minLength={64}
                    maxLength={64}
                  />
                </label>
                <button type="submit">
                  Record independently reviewed original booking evidence
                </button>
              </form>
              <h3>Build 271 · independently certified guest recovery</h3>
              <p>
                A separate campground manager must confirm the original
                processor payment match, site allocation, delivered confirmation
                and guest acknowledgment. This creates an immutable closure
                certificate and does not itself close a reservation or refund a
                payment. Unverified refunds and no-payment assertions remain on
                HOLD.
              </p>
              <form action={certifyBooking271Action}>
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected?.campgroundId ?? ""}
                />
                <input type="hidden" name="recoveryId" value={c.id} />
                <label>
                  Independent review evidence SHA-256
                  <input
                    name="evidenceDigest"
                    required
                    pattern="[a-f0-9]{64}"
                    minLength={64}
                    maxLength={64}
                  />
                </label>
                <button type="submit">
                  Certify original paid-guest recovery
                </button>
              </form>
            </article>
          ))}
        </section>
        {params.field272 ? (
          <p role="status">
            {params.field272 === "recorded"
              ? "Original processor and guest chain evidence recorded. No booking or payment changed."
              : "HOLD — distinct campground reviewer, original provider, guest or site evidence missing."}
          </p>
        ) : null}
        {params.closure271 ? (
          <p role="status">
            {params.closure271 === "certified"
              ? "Independent recovery certificate recorded. An authorized manager may close the case."
              : "HOLD — independent reviewer or original payment, site, delivery or guest outcome evidence missing."}
          </p>
        ) : null}
        <section className="content-panel">
          <h2>Build 273 · signed original booking and Comms consumer ACK</h2>
          <p>Receipt custody: <strong>{consumer273?.status??"HOLD_NO_ASSIGNED_CAMPGROUND"}</strong>.</p>
          <p>Original signed booking consumer ACKs: {consumer273?.bookingAcks??0}.
             Original signed Comms consumer ACKs: {consumer273?.commsAcks??0}.</p>
          <p>Counts are scoped to the assigned campground only. The actual
             consumer must sign its fresh original provider receipt; staff
             cannot manufacture an acknowledgment by entering an arbitrary
             reference. No new charges, bookings or messages are sent by
             this review.</p>
        </section>
        {evidence ? (
          <section className="content-panel">
            <h2>Original evidence: {evidence.status}</h2>
            <p>
              Decision: <strong>{evidence.stage}</strong>
            </p>
            {evidence.evidence ? (
              <dl>
                <dt>Reservation state</dt>
                <dd>{evidence.evidence.reservationStatus}</dd>
                <dt>Accepted booking due (cents)</dt>
                <dd>{evidence.evidence.bookingDueCents ?? "UNKNOWN"}</dd>
                <dt>Internally captured record (cents)</dt>
                <dd>{evidence.evidence.capturedCents}</dd>
                <dt>Provider event receipts (not bank settlement)</dt>
                <dd>{evidence.evidence.providerEventRows}</dd>
                <dt>Reservation confirmation exists</dt>
                <dd>{evidence.evidence.confirmationExists ? "Yes" : "No"}</dd>
                <dt>Receipt records</dt>
                <dd>{evidence.evidence.receiptRows}</dd>
                <dt>Confirmation delivery</dt>
                <dd>{evidence.evidence.deliveryState}</dd>
                <dt>Independently reconciled provider settlement</dt>
                <dd>NOT VERIFIED</dd>
                <dt>
                  Site hold and overlapping inventory independently verified
                </dt>
                <dd>NOT VERIFIED</dd>
              </dl>
            ) : (
              <p>
                No trustworthy reservation evidence is available. No financial
                or booking action should be taken.
              </p>
            )}
            <p>
              Required resolution sequence: verify provider settlement
              independently, compare hold expiry and site allocation, preserve
              the original transaction ID, authorize one reservation outcome or
              one refund, retry only the existing confirmation dispatch
              identifier, then log the guest&apos;s acknowledgment and close the
              local case. Do not charge twice.
            </p>
            <p>
              <Link href="/workspaces/management/campgrounds/operations-centre265">
                Open local support cases and guest follow-up
              </Link>
            </p>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
