import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import {
  getStoreOperationsDashboard,
  storeOperationsPermissions,
} from "@/lib/store-operations/postgres.mjs";
import {
  closePosSessionAction,
  createStockLocationAction,
  openPosSessionAction,
  postStockOperationAction,
  recordStockCountAction,
  reviewPosSessionAction,
  reviewStockCountAction,
  setReorderRuleAction,
} from "./actions";
import styles from "./operations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Stock ledger & POS reconciliation · iCamp",
  robots: { index: false, follow: false },
};
const path = "/workspaces/management/campgrounds/store/operations";
const pretty = (name: string) =>
  name.replaceAll("_", " ").replace(/\b\w/gu, (s) => s.toUpperCase());
const money = (cents: number | null) =>
  cents === null ? "—" : `$${(cents / 100).toFixed(2)}`;
function Stamp({ value }: { value: string | null }) {
  return (
    <time>
      {value ? new Date(value).toLocaleString("en-CA") : "Not recorded"}
    </time>
  );
}
function Hidden({ campgroundId }: { campgroundId: string }) {
  return <input type="hidden" name="campgroundId" value={campgroundId} />;
}
function Key() {
  return <input type="hidden" name="id" value={randomUUID()} />;
}
function ReasonFields({ count = false }: { count?: boolean }) {
  return (
    <>
      <label>
        {count
          ? "Physical count sheet / source reference"
          : "Source reference / receipt / docket"}
        <input
          name="sourceReference"
          required
          minLength={8}
          maxLength={180}
          placeholder="Docket-2026-11-02"
        />
      </label>
      <label>
        Reason and supporting observation
        <textarea
          name="reasonNote"
          required
          minLength={12}
          maxLength={800}
          rows={2}
          placeholder="Describe what staff observed and where the source is kept."
        />
      </label>
    </>
  );
}

export default async function StoreOperationsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (camp) => ({
        ...camp,
        permissions: await storeOperationsPermissions(
          session.user.id,
          camp.campgroundId,
        ),
      })),
    )
  ).filter((c) => Object.values(c.permissions).some(Boolean));
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((c) => c.campgroundId === params.campground) ?? allowed[0];
  const data = await getStoreOperationsDashboard(
    session.user.id,
    selected.campgroundId,
  );
  const {
    products,
    locations,
    balances,
    rules,
    counts,
    countReviews,
    sessions,
    posReviews,
    events,
    permissions,
    suggestions,
  } = data;
  const productName = (id: string) =>
    products.find((p) => p.id === id)?.name ?? "Restricted product";
  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.displayName ?? "Restricted location";
  const position = (productId: string, locationId: string) =>
    balances.find(
      (b) => b.productId === productId && b.locationId === locationId,
    );
  const stockOptions = products.slice(0, 120).flatMap((product) =>
    locations.slice(0, 20).map((loc) => {
      const balance = position(product.id, loc.id);
      const version = balance?.rowVersion ?? 0;
      return {
        value: `${product.id}:${loc.id}:${version}`,
        label: `${product.sku} · ${loc.displayName} — ${version ? `${balance?.quantityOnHand ?? 0} on hand` : "not initialized"}`,
        initialized: version > 0,
      };
    }),
  );
  const openSessions = sessions.filter((s) => s.status === "open");
  const pendingCounts = counts.filter(
    (c) => !countReviews.some((r) => r.countId === c.id),
  );
  const pendingSessionReview = sessions.filter(
    (s) =>
      s.status === "closed" && !posReviews.some((r) => r.sessionId === s.id),
  );
  const attention = suggestions.filter(
    (s) => s.needsOpeningCount || s.suggestedQuantity > 0,
  );
  const uninitialized = stockOptions.filter((s) => !s.initialized).length;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management/campgrounds/store">Store</Link>
          <span aria-hidden="true">/</span>
          <span>Inventory &amp; POS evidence</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">
            Build 192 · Stock and register command centre
          </p>
          <h1>Store inventory, POS sessions &amp; reconciliation</h1>
          <p className="hero-panel__lead">
            Track every receipt, transfer, damage, return and internal POS stock
            issue against an immutable physical ledger. Compare independent
            counts, register close evidence and owner-set reorder thresholds.
          </p>
          <p>
            <strong>Safety gate:</strong> Register amounts are manually entered
            bookkeeping evidence, not card charges, settlement, invoices or
            accepted guest-cart orders. Billing, payments, supplier purchases
            and Omnichannel remain HELD.
          </p>
          <div className="hero-actions">
            <Link
              href="/workspaces/management/campgrounds/store"
              className="secondary-link"
            >
              Catalog &amp; guest cart review
            </Link>
          </div>
        </section>

        {params.saved ? (
          <p
            role="status"
            className={
              params.saved.startsWith("Not saved")
                ? styles.error
                : styles.notice
            }
          >
            {params.saved}
          </p>
        ) : null}

        <section className="content-panel" aria-labelledby="stock-scope">
          <SectionHeading
            id="stock-scope"
            eyebrow="Campground isolation"
            title="Authorized store scope"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.row}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {allowed.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open stock workboard
            </button>
          </form>
          <div className={styles.metrics}>
            <div>
              <strong>{products.length}</strong>
              <span>Catalog products</span>
            </div>
            <div>
              <strong>{events.length}</strong>
              <span>Recent immutable movements</span>
            </div>
            <div>
              <strong>{pendingCounts.length}</strong>
              <span>Counts awaiting review</span>
            </div>
            <div>
              <strong>{pendingSessionReview.length}</strong>
              <span>Register closures awaiting review</span>
            </div>
          </div>
          <p className={styles.help}>
            Existing Build 183 staff-observed stock is a separate historical
            snapshot. We never convert it into sellable stock automatically. A
            source-backed opening count or receipt starts each new location
            balance. All counts and movements require permission and are stamped
            with an actor.
          </p>
        </section>

        {permissions.manage ? (
          <section className="content-panel" aria-labelledby="stock-setup">
            <SectionHeading
              id="stock-setup"
              eyebrow="Setup without hidden inventory"
              title="Locations &amp; reorder rules"
              helpTopic="shell.overview"
            />
            <div className={styles.columns}>
              <form action={createStockLocationAction} className={styles.form}>
                <Hidden campgroundId={selected.campgroundId} />
                <Key />
                <h3>Register a physical stock location</h3>
                <label>
                  Code (2–40 characters)
                  <input
                    name="locationCode"
                    required
                    minLength={2}
                    maxLength={40}
                    placeholder="sales_floor"
                  />
                </label>
                <label>
                  Location name
                  <input
                    name="displayName"
                    required
                    minLength={3}
                    maxLength={90}
                    placeholder="Main store sales floor"
                  />
                </label>
                <button className="primary-button" type="submit">
                  Create location
                </button>
              </form>
              <div>
                <h3>Reorder suggestions, never automatic purchases</h3>
                {products.length ? (
                  <div className={styles.scrollList}>
                    {products.map((p) => {
                      const rule = rules.find((r) => r.productId === p.id);
                      return (
                        <form
                          action={setReorderRuleAction}
                          key={p.id}
                          className={styles.rule}
                        >
                          <Hidden campgroundId={selected.campgroundId} />
                          <input type="hidden" name="productId" value={p.id} />
                          <input
                            type="hidden"
                            name="expectedVersion"
                            value={rule?.rowVersion ?? 0}
                          />
                          <strong>{p.name}</strong>
                          <div className={styles.row}>
                            <label>
                              Alert at / below
                              <input
                                name="reorderPoint"
                                aria-label={`Reorder point for ${p.name}`}
                                type="number"
                                min={0}
                                max={999999}
                                required
                                defaultValue={rule?.reorderPoint ?? 3}
                              />
                            </label>
                            <label>
                              Target units
                              <input
                                name="targetQuantity"
                                aria-label={`Reorder target for ${p.name}`}
                                type="number"
                                min={1}
                                max={999999}
                                required
                                defaultValue={rule?.targetQuantity ?? 10}
                              />
                            </label>
                            <button type="submit" className="secondary-button">
                              Save rule
                            </button>
                          </div>
                        </form>
                      );
                    })}
                  </div>
                ) : (
                  <p>
                    No catalog products. Add reviewed products in Store
                    Management first.
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="stock-positions">
          <SectionHeading
            id="stock-positions"
            eyebrow="Source-backed availability"
            title="Current stock positions &amp; reorder attention"
            helpTopic="shell.overview"
          />
          {balances.filter((b) => b.rowVersion > 0).length ? (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Location</th>
                    <th scope="col">On hand</th>
                    <th scope="col">Version</th>
                    <th scope="col">Last changed</th>
                  </tr>
                </thead>
                <tbody>
                  {balances
                    .filter((b) => b.rowVersion > 0)
                    .map((b) => (
                      <tr key={`${b.productId}:${b.locationId}`}>
                        <td>{productName(b.productId)}</td>
                        <td>{locationName(b.locationId)}</td>
                        <td>
                          <strong>{b.quantityOnHand}</strong>
                        </td>
                        <td>{b.rowVersion}</td>
                        <td>
                          <Stamp value={b.updatedAt} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>
              No authoritative stock yet. Record an opening count with a
              physical source; older catalog observations are not stock
              allocations.
            </p>
          )}
          {attention.length ? (
            <div className={styles.attention} role="status">
              <h3>{attention.length} reorder / opening-count suggestions</h3>
              <ul>
                {attention.map((s) => (
                  <li key={s.productId}>
                    <strong>{s.productName}:</strong>{" "}
                    {s.needsOpeningCount
                      ? "Opening count not established"
                      : `${s.quantity} on hand, suggest ${s.suggestedQuantity} units to reach ${s.targetQuantity}`}
                    . <em>Suggestion only; no purchase created.</em>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={styles.help}>
              No configured product currently crosses its reorder threshold.
            </p>
          )}
        </section>

        {permissions.manage ? (
          <section className="content-panel" aria-labelledby="stock-movements">
            <SectionHeading
              id="stock-movements"
              eyebrow="Atomic movement · optimistic versions"
              title="Post a stock movement or POS issue"
              helpTopic="shell.overview"
            />
            {!locations.length || !products.length ? (
              <p className={styles.empty}>
                Create a location and store catalog product before posting
                physical movement evidence.
              </p>
            ) : (
              <form action={postStockOperationAction} className={styles.form}>
                <Hidden campgroundId={selected.campgroundId} />
                <Key />
                <div className={styles.columns}>
                  <label>
                    Product and source location
                    <select name="stockKey" required defaultValue="">
                      <option value="" disabled>
                        Choose an exact product/location/version
                      </option>
                      {stockOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Movement type
                    <select name="kind" required defaultValue="receipt">
                      <option value="opening_count">
                        Initial physical opening count (+)
                      </option>
                      <option value="receipt">Documented receipt (+)</option>
                      <option value="transfer">
                        Paired location transfer (− / +)
                      </option>
                      <option value="damage">Damage / waste (−)</option>
                      <option value="return">Returned goods (+)</option>
                      <option value="pos_sale">
                        POS stock issue (−; unsettled)
                      </option>
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input
                      type="number"
                      name="quantity"
                      required
                      min={1}
                      max={9999}
                      defaultValue={1}
                    />
                  </label>
                  <label>
                    Destination (paired transfers only)
                    <select name="destinationKey" defaultValue="">
                      <option value="">No destination</option>
                      {stockOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Open POS session (POS stock issues only)
                    <select name="posSessionId" defaultValue="">
                      <option value="">Not a POS stock issue</option>
                      {openSessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.registerCode} · open session
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Expected register amount in cents (POS only; unsettled)
                    <input
                      type="number"
                      name="expectedCashCents"
                      min={1}
                      max={100000000}
                      placeholder="1299 = $12.99"
                    />
                  </label>
                  <ReasonFields />
                </div>
                <p className={styles.help}>
                  Use the destination only for paired transfers, and the
                  session/amount only for POS stock issues. A sale will fail if
                  the register is closed or available stock would go negative.
                  Refresh if either location version has changed.
                </p>
                <button className="primary-button" type="submit">
                  Post atomic stock evidence
                </button>
              </form>
            )}
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="stock-counts">
          <SectionHeading
            id="stock-counts"
            eyebrow="Separation of duties"
            title="Physical counts &amp; independent variance review"
            helpTopic="shell.overview"
          />
          {permissions.manage && stockOptions.some((o) => o.initialized) ? (
            <form action={recordStockCountAction} className={styles.form}>
              <Hidden campgroundId={selected.campgroundId} />
              <Key />
              <div className={styles.columns}>
                <label>
                  Initialized product / location
                  <select name="stockKey" required defaultValue="">
                    <option value="" disabled>
                      Choose stock position
                    </option>
                    {stockOptions
                      .filter((o) => o.initialized)
                      .map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Actually counted units
                  <input
                    type="number"
                    name="observedQuantity"
                    min={0}
                    max={999999}
                    required
                  />
                </label>
                <ReasonFields count />
              </div>
              <button type="submit" className="primary-button">
                Submit count for independent review
              </button>
            </form>
          ) : (
            <p className={styles.empty}>
              Physical count submission requires an initialized ledger and
              inventory management permission.
            </p>
          )}
          <h3>Counts awaiting independent review ({pendingCounts.length})</h3>
          {pendingCounts.length ? (
            <div className={styles.cards}>
              {pendingCounts.map((c) => {
                const independent =
                  permissions.audit && c.countedByUserId !== session.user.id;
                return (
                  <article className={styles.card} key={c.id}>
                    <h4>
                      {productName(c.productId)} · {locationName(c.locationId)}
                    </h4>
                    <p>
                      Recorded {c.expectedQuantity} / counted{" "}
                      <strong>{c.observedQuantity}</strong> / difference{" "}
                      <strong>
                        {c.observedQuantity - c.expectedQuantity > 0 ? "+" : ""}
                        {c.observedQuantity - c.expectedQuantity}
                      </strong>
                    </p>
                    <p>
                      Version {c.expectedVersion} ·{" "}
                      <Stamp value={c.countedAt} /> · Source {c.sourceReference}
                    </p>
                    <p>{c.reasonNote}</p>
                    {independent ? (
                      <form
                        action={reviewStockCountAction}
                        className={styles.form}
                      >
                        <Hidden campgroundId={selected.campgroundId} />
                        <Key />
                        <input type="hidden" name="countId" value={c.id} />
                        <input
                          type="hidden"
                          name="adjustmentEventId"
                          value={randomUUID()}
                        />
                        <label>
                          Decision
                          <select name="decision" defaultValue="reject">
                            <option value="reject">
                              Reject / request recount
                            </option>
                            <option value="accept">
                              Accept evidence (posts counted variance if
                              current)
                            </option>
                          </select>
                        </label>
                        <label>
                          Independent reviewer evidence
                          <textarea
                            name="reasonNote"
                            minLength={12}
                            maxLength={800}
                            required
                            rows={2}
                          />
                        </label>
                        <button className="secondary-button" type="submit">
                          Record review
                        </button>
                      </form>
                    ) : (
                      <p className={styles.help}>
                        Awaiting a different authorized inventory reviewer. The
                        counter cannot approve their own count.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={styles.empty}>No counts are waiting for review.</p>
          )}
        </section>

        <section className="content-panel" aria-labelledby="pos-sessions">
          <SectionHeading
            id="pos-sessions"
            eyebrow="Register evidence · no processor connection"
            title="POS session opening, closing &amp; till exception"
            helpTopic="shell.overview"
          />
          {permissions.manage ? (
            <form action={openPosSessionAction} className={styles.row}>
              <Hidden campgroundId={selected.campgroundId} />
              <Key />
              <label>
                Register code
                <input
                  name="registerCode"
                  minLength={2}
                  maxLength={40}
                  required
                  placeholder="front_desk"
                />
              </label>
              <label>
                Manually observed opening cash (cents)
                <input
                  type="number"
                  name="openingCashCents"
                  min={0}
                  max={100000000}
                  required
                  defaultValue={0}
                />
              </label>
              <button className="primary-button" type="submit">
                Open new register session
              </button>
            </form>
          ) : null}
          <h3>Open register sessions ({openSessions.length})</h3>
          {openSessions.length ? (
            <div className={styles.cards}>
              {openSessions.map((s) => (
                <article className={styles.card} key={s.id}>
                  <h4>{s.registerCode} · opened</h4>
                  <p>
                    Opening observed: {money(s.openingCashCents)} ·{" "}
                    <Stamp value={s.openedAt} />
                  </p>
                  {permissions.manage ? (
                    <form
                      action={closePosSessionAction}
                      className={styles.form}
                    >
                      <Hidden campgroundId={selected.campgroundId} />
                      <input type="hidden" name="sessionId" value={s.id} />
                      <input
                        type="hidden"
                        name="expectedVersion"
                        value={s.rowVersion}
                      />
                      <label>
                        Observed closing cash (cents)
                        <input
                          type="number"
                          name="observedCashCents"
                          min={0}
                          max={100000000}
                          required
                        />
                      </label>
                      <label>
                        Closing witness note
                        <textarea
                          name="note"
                          minLength={12}
                          maxLength={500}
                          required
                          rows={2}
                        />
                      </label>
                      <button className="secondary-button" type="submit">
                        Close and freeze reconciliation
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              No open register. Internal POS stock issue entries require an open
              register.
            </p>
          )}
          <h3>
            Closed sessions awaiting independent review (
            {pendingSessionReview.length})
          </h3>
          {pendingSessionReview.length ? (
            <div className={styles.cards}>
              {pendingSessionReview.map((s) => {
                const variance =
                  (s.observedCashCents ?? 0) - (s.expectedCashCents ?? 0);
                const independent =
                  permissions.audit &&
                  ![s.openedByUserId, s.closedByUserId].includes(
                    session.user.id,
                  );
                return (
                  <article className={styles.card} key={s.id}>
                    <h4>{s.registerCode} · closed</h4>
                    <p>
                      Expected {money(s.expectedCashCents)} · observed{" "}
                      {money(s.observedCashCents)} ·{" "}
                      <strong>variance {money(variance)}</strong>
                    </p>
                    <p>
                      <Stamp value={s.closedAt} /> · {s.closingNote}
                    </p>
                    {independent ? (
                      <form
                        action={reviewPosSessionAction}
                        className={styles.form}
                      >
                        <Hidden campgroundId={selected.campgroundId} />
                        <Key />
                        <input type="hidden" name="sessionId" value={s.id} />
                        <label>
                          Independent disposition
                          <select
                            name="disposition"
                            defaultValue="exception_open"
                          >
                            <option value="exception_open">
                              Keep till exception open
                            </option>
                            {variance === 0 ? (
                              <option value="accepted">
                                Accept balanced till evidence
                              </option>
                            ) : null}
                          </select>
                        </label>
                        <label>
                          Reviewer explanation
                          <textarea
                            name="reasonNote"
                            minLength={12}
                            maxLength={800}
                            required
                            rows={2}
                          />
                        </label>
                        <button type="submit" className="secondary-button">
                          Record independent review
                        </button>
                      </form>
                    ) : (
                      <p className={styles.help}>
                        Pending independent reviewer not involved in opening or
                        closing. Variances cannot be auto-accepted.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={styles.empty}>No register closures require review.</p>
          )}
        </section>

        <section className="content-panel" aria-labelledby="stock-history">
          <SectionHeading
            id="stock-history"
            eyebrow="Attributed, immutable and source-backed"
            title="Recent stock movement history"
            helpTopic="shell.overview"
          />
          {events.length ? (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Recorded</th>
                    <th scope="col">Product / location</th>
                    <th scope="col">Event</th>
                    <th scope="col">Delta</th>
                    <th scope="col">After</th>
                    <th scope="col">Source &amp; reason</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Stamp value={e.recordedAt} />
                      </td>
                      <td>
                        {productName(e.productId)} ·{" "}
                        {locationName(e.locationId)}
                      </td>
                      <td>{pretty(e.kind)}</td>
                      <td>
                        {e.quantityChange > 0 ? "+" : ""}
                        {e.quantityChange}
                      </td>
                      <td>{e.quantityAfter}</td>
                      <td>
                        {e.sourceReference}
                        <span className={styles.subtle}>{e.reasonNote}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>
              No immutable stock movements have been entered for this
              campground.
            </p>
          )}
          <p className={styles.help}>
            {uninitialized} of the visible product/location choices have no
            initialized stock evidence. Cross-property data, direct card
            charging, automatic reorders, physical dispatch and guest cart
            fulfillment are not part of this release. Staff Web/PWA only; IVR,
            SMS and MMS remain HELD.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
