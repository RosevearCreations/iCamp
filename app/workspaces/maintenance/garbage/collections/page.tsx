import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  getCollectionOperations,
  getGarbageFinanceReview,
} from "@/lib/garbage-collections/postgres.mjs";
import {
  createCollectionRouteAction,
  recordCollectionProofAction,
  recordGarbageFinanceReviewAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Garbage collection & reconciliation · iCamp",
};
type Params = Promise<{ campground?: string; saved?: string }>;
const title = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const path = "/workspaces/maintenance/garbage/collections";
  const params = await searchParams;
  const session = await requireAnyCampgroundPermission("garbage.read", path);
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (campground) => ({
        campground,
        permitted: await hasCampgroundPermission(
          session.user.id,
          campground.campgroundId,
          "garbage.read",
        ),
      })),
    )
  )
    .filter((entry) => entry.permitted)
    .map((entry) => entry.campground);
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((entry) => entry.campgroundId === params.campground) ??
    allowed[0];
  const [canManage, canReconcile, operations] = await Promise.all([
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "garbage.routes.manage",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "garbage.finance.reconcile",
    ),
    getCollectionOperations(session.user.id, selected.campgroundId),
  ]);
  const finance = canReconcile
    ? await getGarbageFinanceReview(session.user.id, selected.campgroundId)
    : null;
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/maintenance/garbage">Garbage services</Link>
          <span> / </span>
          <span>Collection & reconciliation</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 081 · Field & finance evidence</p>
          <h1>Collection Routes & Receipt Review</h1>
          <p className="hero-panel__lead">
            Plan waste collection routes, document each pickup outcome and
            independently review paid-tag receipt references. Collection proof
            never silently closes a pickup or records a payment capture.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="collection-scope"
            eyebrow="Campground"
            title="Operating scope"
            helpTopic="garbage.collections"
          />
          <form action={path} method="get">
            <label htmlFor="collection-campground">Campground</label>
            <select
              id="collection-campground"
              name="campground"
              defaultValue={selected.campgroundId}
            >
              {allowed.map((item) => (
                <option key={item.campgroundId} value={item.campgroundId}>
                  {item.campgroundName}
                </option>
              ))}
            </select>
            <button type="submit">Open campground</button>
          </form>
          {params.saved ? <p role="status">{params.saved}</p> : null}
        </section>
        {canManage ? (
          <section className="content-panel">
            <SectionHeading
              id="collection-create"
              eyebrow="Dispatch"
              title="Create collection route"
              helpTopic="garbage.collections"
            />
            <form action={createCollectionRouteAction}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="clientRouteId" value={randomUUID()} />
              <label>
                Route name
                <input
                  name="name"
                  minLength={3}
                  maxLength={120}
                  required
                  placeholder="North loop morning"
                />
              </label>
              <label>
                Waste stream
                <select name="stream">
                  <option value="garbage">Garbage</option>
                  <option value="recycling">Recycling</option>
                  <option value="organics">Organics</option>
                </select>
              </label>
              <label>
                Service date
                <input name="serviceDate" type="date" required />
              </label>
              <label>
                Route instructions
                <input
                  name="note"
                  maxLength={1000}
                  placeholder="Optional dispatch details"
                />
              </label>
              <button type="submit">Create route</button>
            </form>
          </section>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="collection-routes"
            eyebrow="Field dispatch"
            title="Routes & pickup evidence"
            helpTopic="garbage.collections"
          />
          <p>
            Proof is append-only: record bags collected or why a stop could not
            be serviced. For a successful collection, first move the canonical
            pickup to in progress in Garbage Services.
          </p>
          <div className="card-grid">
            {operations.routes.map((route) => {
              const eligible = operations.pickups.filter(
                (p) => p.stream === route.stream,
              );
              const routeProofs = operations.proofs.filter(
                (p) => p.route_id === route.id,
              );
              return (
                <article className="content-panel" key={route.id}>
                  <h3>{route.name}</h3>
                  <p>
                    {route.stream} · {String(route.service_date).slice(0, 10)}
                  </p>
                  {route.route_note ? <p>{route.route_note}</p> : null}
                  <p>{routeProofs.length} recorded stop outcome(s)</p>
                  {canManage ? (
                    <form action={recordCollectionProofAction}>
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input type="hidden" name="routeId" value={route.id} />
                      <label>
                        Pickup
                        <select name="pickupId" required>
                          {eligible.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.accommodation_code} · {p.state} ·{" "}
                              {p.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Outcome
                        <select name="outcome">
                          <option value="collected">Collected</option>
                          <option value="not_accessible">Not accessible</option>
                          <option value="not_ready">Not ready</option>
                          <option value="missed">Missed</option>
                        </select>
                      </label>
                      <label>
                        Bags collected (zero if skipped)
                        <input
                          name="bagCount"
                          type="number"
                          min="0"
                          max="1000"
                          defaultValue="1"
                          required
                        />
                      </label>
                      <label>
                        Collection evidence note
                        <input
                          name="note"
                          minLength={4}
                          maxLength={1000}
                          required
                          placeholder="What was observed?"
                        />
                      </label>
                      <label>
                        Evidence/media reference (optional)
                        <input
                          name="evidenceReference"
                          minLength={4}
                          maxLength={240}
                          placeholder="Existing media identifier"
                        />
                      </label>
                      <button type="submit" disabled={!eligible.length}>
                        Record pickup outcome
                      </button>
                    </form>
                  ) : null}
                  {routeProofs.map((proof) => (
                    <p key={proof.id}>
                      {proof.accommodation_code}: {title(proof.outcome)} ·{" "}
                      {proof.bag_count} bag(s) · {proof.note}
                    </p>
                  ))}
                </article>
              );
            })}
          </div>
          {!operations.routes.length ? <p>No collection routes yet.</p> : null}
        </section>
        {finance ? (
          <section className="content-panel">
            <SectionHeading
              id="collection-finance"
              eyebrow="Owner finance review"
              title="Paid tag receipt reconciliation"
              helpTopic="garbage.collections"
            />
            <p>
              Independently locate the exact receipt in our POS/payment records
              before marking a match. A review is a human attestation only; it
              neither charges nor refunds a guest.
            </p>
            <p>
              {finance.tags.length} recent issued tag(s),{" "}
              {finance.tags.filter((t) => t.redeemed_at).length} redeemed,{" "}
              {finance.reviews.length} review event(s) in the latest window.
            </p>
            <form action={recordGarbageFinanceReviewAction}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="clientReviewId" value={randomUUID()} />
              <label>
                Issued tag
                <select name="tagId" required>
                  {finance.tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.tag_code} · {tag.accommodation_code} · CAD{" "}
                      {(tag.price_cents / 100).toFixed(2)} · receipt{" "}
                      {tag.receipt_reference}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Review decision
                <select name="decision">
                  <option value="needs_followup">Needs follow-up</option>
                  <option value="receipt_matched">
                    Receipt independently matched
                  </option>
                  <option value="disputed">Disputed</option>
                </select>
              </label>
              <label>
                Independently checked amount (CAD cents; required for match)
                <input
                  name="checkedAmountCents"
                  type="number"
                  min="0"
                  max="1000000"
                  placeholder="Receipt total in cents"
                />
              </label>
              <label>
                Review note
                <input
                  name="note"
                  minLength={4}
                  maxLength={1000}
                  required
                  placeholder="POS transaction/date and findings"
                />
              </label>
              <button type="submit" disabled={!finance.tags.length}>
                Record immutable review
              </button>
            </form>
            <div className="card-grid">
              {finance.reviews.map((review) => (
                <article className="content-panel" key={review.id}>
                  <h3>{title(review.decision)}</h3>
                  <p>
                    {finance.tags.find((tag) => tag.id === review.tag_id)
                      ?.tag_code ?? review.tag_id}
                  </p>
                  <p>
                    {review.checked_amount_cents == null
                      ? "Amount not checked"
                      : `Checked CAD ${(review.checked_amount_cents / 100).toFixed(2)}`}
                  </p>
                  <p>{review.note}</p>
                </article>
              ))}
            </div>
            {!finance.reviews.length ? (
              <p>No receipt reviews recorded yet.</p>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
