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
import { listGarbageTags } from "@/lib/garbage-tags/postgres.mjs";
import { issueTagAction, redeemTagAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paid garbage tags · iCamp" };
type Params = Promise<{ campground?: string; saved?: string }>;
export default async function GarbageTagsPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const path = "/workspaces/maintenance/garbage/tags";
  const params = await searchParams;
  const session = await requireAnyCampgroundPermission("garbage.read", path);
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (campground) => ({
        campground,
        allowed: await hasCampgroundPermission(
          session.user.id,
          campground.campgroundId,
          "garbage.read",
        ),
      })),
    )
  )
    .filter((item) => item.allowed)
    .map((item) => item.campground);
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((item) => item.campgroundId === params.campground) ??
    allowed[0];
  const [snapshot, canSell, canRedeem] = await Promise.all([
    listGarbageTags(session.user.id, selected.campgroundId),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "garbage.tags.sell",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "garbage.tags.redeem",
    ),
  ]);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/maintenance/garbage">Garbage services</Link>
          <span> / </span>
          <span>Paid tags</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 080 · Paid pickup</p>
          <h1>Garbage Stickers & Tags</h1>
          <p className="hero-panel__lead">
            Issue serialized one-use tags against verified receipts, then redeem
            them for matching campground pickups. This screen does not process
            payments or create receipts.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="tag-scope"
            eyebrow="Campground"
            title="Campground & evidence"
            helpTopic="garbage.tags"
          />
          <form action={path} method="get">
            <label htmlFor="tag-campground">Campground</label>
            <select
              id="tag-campground"
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
        {canSell ? (
          <section className="content-panel">
            <SectionHeading
              id="tag-issue"
              eyebrow="Point of sale"
              title="Issue a paid tag"
              helpTopic="garbage.tags"
            />
            <p>
              Verify a payment in the separate POS or receipt system first.
              Record its exact reference here; a tag sale is not a card charge.
            </p>
            <form action={issueTagAction}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="saleId" value={randomUUID()} />
              <label>
                Waste stream
                <select name="stream" required>
                  <option value="garbage">Garbage</option>
                  <option value="recycling">Recycling</option>
                  <option value="organics">Organics</option>
                </select>
              </label>
              <label>
                Campground site
                <select name="accommodationId" required>
                  {snapshot.sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Checked-in reservation ID (optional)
                <input
                  name="reservationId"
                  placeholder="UUID if linked to stay"
                />
              </label>
              <label>
                Paid amount (CAD cents)
                <input
                  type="number"
                  name="priceCents"
                  min="1"
                  max="1000000"
                  required
                />
              </label>
              <label>
                Verified receipt/POS reference
                <input
                  name="receiptReference"
                  minLength={4}
                  maxLength={120}
                  required
                />
              </label>
              <button type="submit" disabled={!snapshot.sites.length}>
                Issue serialized tag
              </button>
            </form>
          </section>
        ) : null}
        {canRedeem ? (
          <section className="content-panel">
            <SectionHeading
              id="tag-redeem"
              eyebrow="Pickup"
              title="Redeem at pickup"
              helpTopic="garbage.tags"
            />
            <p>
              Use the printed GT-code or scanned code text. Redemption accepts
              one matching paid on-demand pickup, site, stream and stay.
            </p>
            <form action={redeemTagAction}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label>
                Tag code
                <input name="tagCode" placeholder="GT-..." required />
              </label>
              <label>
                Open pickup
                <select name="pickupId" required>
                  {snapshot.pickups.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.accommodation_code} · {p.stream} · {p.state} ·{" "}
                      {p.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={!snapshot.pickups.length}>
                Redeem once
              </button>
            </form>
          </section>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="tag-history"
            eyebrow="Ledger"
            title="Issued tags & redemption history"
            helpTopic="garbage.tags"
          />
          <div className="card-grid">
            {snapshot.tags.map((tag) => (
              <article className="content-panel" key={tag.id}>
                <h3>{tag.tag_code}</h3>
                <p>
                  {tag.accommodation_code} · {tag.stream} · CAD{" "}
                  {(tag.price_cents / 100).toFixed(2)}
                </p>
                <p>Receipt: {tag.receipt_reference}</p>
                <p>
                  {tag.redeemed_at
                    ? `Redeemed ${new Date(tag.redeemed_at).toLocaleString("en-CA")}`
                    : "Available · not redeemed"}
                </p>
              </article>
            ))}
          </div>
          {!snapshot.tags.length ? <p>No paid tags recorded.</p> : null}
        </section>
      </div>
    </AppShell>
  );
}
