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
  GARBAGE_SERVICE_MODES,
  GARBAGE_STREAMS,
} from "@/lib/garbage-service/core.mjs";
import { getGarbageServiceSnapshot } from "@/lib/garbage-service/postgres.mjs";

import {
  requestGarbagePickupAction,
  saveGarbagePolicyAction,
  transitionGarbagePickupAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Garbage services · iCamp",
  description:
    "Configure campground garbage, recycling and organics service and pickup.",
};

type Params = Promise<{ campground?: string; saved?: string }>;
type Policy = {
  id: string;
  stream: string;
  service_mode: string;
  row_version: string;
  fee_cents: number;
  weekday: number | null;
  enabled: boolean;
  instructions: string | null;
  location_description: string | null;
};
type Pickup = {
  id: string;
  accommodation_code: string;
  stream: string;
  service_mode: string;
  state: string;
  row_version: string;
  fee_cents: number;
  billing_state: string;
  created_at: string;
  note: string | null;
};

const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function GarbageServicesPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const path = "/workspaces/maintenance/garbage";
  const params = await searchParams;
  const session = await requireAnyCampgroundPermission("garbage.read", path);
  const assigned = await listAssignedCampgrounds(session.user.id);
  const checks = await Promise.all(
    assigned.map(async (campground) => ({
      campground,
      read: await hasCampgroundPermission(
        session.user.id,
        campground.campgroundId,
        "garbage.read",
      ),
    })),
  );
  const allowed = checks
    .filter((item) => item.read)
    .map((item) => item.campground);
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((item) => item.campgroundId === params.campground) ??
    allowed[0];
  const [canConfigure, canDispatch, snapshot] = await Promise.all([
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "garbage.configure",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "garbage.dispatch",
    ),
    getGarbageServiceSnapshot(session.user.id, selected.campgroundId),
  ]);
  const policies = snapshot.policies as Policy[];
  const pickups = snapshot.pickups as Pickup[];
  const enabledPickups = policies.filter(
    (policy) => policy.enabled && policy.service_mode !== "central_bins",
  );

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span> / </span>
          <span>Garbage services</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 079 · Campground services</p>
          <h1>Garbage, Recycling & Organics</h1>
          <p className="hero-panel__lead">
            Choose central-bin, included site pickup, scheduled site pickup or
            paid on-demand models independently for each waste stream. Pickup
            operations stay separate from maintenance work orders and billing.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="garbage-tags-link"
            eyebrow="Paid pickup"
            title="Paid stickers & tags"
            helpTopic="garbage.tags"
          />
          <p>
            Issue one-use paid waste tags from verified receipt evidence and
            redeem them against a matching on-demand pickup.
          </p>
          <Link href="/workspaces/maintenance/garbage/tags">
            Open paid tag register & redemption
          </Link>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Field & finance"
            id="garbage-collection-link"
            title="Collection & receipt review"
            helpTopic="garbage.collections"
          />
          <p>
            Plan waste routes, record observed pickup outcomes and review
            paid-tag receipt evidence without inventing payment captures.
          </p>
          <Link href="/workspaces/maintenance/garbage/collections">
            Open collection & reconciliation workspace
          </Link>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Campground"
            title="Service scope"
            id="garbage-scope"
            helpTopic="garbage.services"
          />
          <form action={path} method="get">
            <label htmlFor="garbage-campground">Campground</label>
            <select
              id="garbage-campground"
              name="campground"
              defaultValue={selected.campgroundId}
            >
              {allowed.map((campground) => (
                <option
                  key={campground.campgroundId}
                  value={campground.campgroundId}
                >
                  {campground.campgroundName}
                </option>
              ))}
            </select>
            <button type="submit">Open campground</button>
          </form>
          {params.saved ? <p role="status">{params.saved}</p> : null}
        </section>
        <section className="content-panel" aria-labelledby="garbage-policies">
          <SectionHeading
            eyebrow="Service configuration"
            title="Methods & waste streams"
            id="garbage-policies"
            helpTopic="garbage.services"
          />
          <p>
            Central bins are self-service. Scheduled pickups use a weekday
            (Sunday = 0). Paid pickup fees are stored in Canadian cents; a quote
            is not a payment.
          </p>
          <div className="card-grid">
            {GARBAGE_STREAMS.flatMap((stream) =>
              GARBAGE_SERVICE_MODES.map((mode) => {
                const current = policies.find(
                  (p) => p.stream === stream && p.service_mode === mode,
                );
                return (
                  <article className="content-panel" key={`${stream}-${mode}`}>
                    <h3>
                      {label(stream)} · {label(mode)}
                    </h3>
                    <p>{current?.enabled ? "Enabled" : "Not enabled"}</p>
                    {canConfigure ? (
                      <form action={saveGarbagePolicyAction}>
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input type="hidden" name="stream" value={stream} />
                        <input type="hidden" name="mode" value={mode} />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={current?.row_version ?? "0"}
                        />
                        <label>
                          Availability
                          <select
                            name="isEnabled"
                            defaultValue={current?.enabled ? "true" : "false"}
                          >
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                          </select>
                        </label>
                        {mode === "scheduled_site_pickup" ? (
                          <label>
                            Pickup weekday (0–6)
                            <input
                              name="weekday"
                              type="number"
                              min="0"
                              max="6"
                              required
                              defaultValue={current?.weekday ?? ""}
                            />
                          </label>
                        ) : null}
                        {mode === "paid_on_demand" ? (
                          <label>
                            Fee (CAD cents)
                            <input
                              name="feeCents"
                              type="number"
                              min="1"
                              max="1000000"
                              required
                              defaultValue={current?.fee_cents ?? 500}
                            />
                          </label>
                        ) : null}
                        {mode === "central_bins" ? (
                          <label>
                            Bin location
                            <input
                              name="locationDescription"
                              maxLength={240}
                              defaultValue={current?.location_description ?? ""}
                            />
                          </label>
                        ) : null}
                        <label>
                          Instructions
                          <textarea
                            name="instructions"
                            maxLength={1000}
                            defaultValue={current?.instructions ?? ""}
                          />
                        </label>
                        <button type="submit">Save service</button>
                      </form>
                    ) : null}
                  </article>
                );
              }),
            )}
          </div>
        </section>
        <section className="content-panel" aria-labelledby="garbage-requests">
          <SectionHeading
            eyebrow="Pickup desk"
            title="New site pickup"
            id="garbage-requests"
            helpTopic="garbage.services"
          />
          {canDispatch ? (
            <form action={requestGarbagePickupAction}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input
                type="hidden"
                name="clientRequestId"
                value={randomUUID()}
              />
              <label>
                Site
                <select name="accommodationId" required defaultValue="">
                  <option value="" disabled>
                    Select a site
                  </option>
                  {snapshot.accommodations.map(
                    (site: { id: string; code: string }) => (
                      <option key={site.id} value={site.id}>
                        {site.code}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Offered pickup service
                <select name="service" required>
                  {enabledPickups.map((policy) => (
                    <option
                      key={policy.id}
                      value={`${policy.stream}|${policy.service_mode}`}
                    >
                      {label(policy.stream)} · {label(policy.service_mode)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pickup notes
                <textarea name="note" maxLength={1000} />
              </label>
              <p>
                Only enabled combinations can be requested. Paid pickup is
                recorded as pending checkout; no money is collected here.
              </p>
              <button type="submit" disabled={!enabledPickups.length}>
                Record pickup request
              </button>
            </form>
          ) : (
            <p>Pickup dispatch access is required to create requests.</p>
          )}
        </section>
        <section className="content-panel" aria-labelledby="garbage-queue">
          <SectionHeading
            eyebrow="Operational ledger"
            title="Pickup queue"
            id="garbage-queue"
            helpTopic="garbage.services"
          />
          {pickups.length === 0 ? (
            <p>No pickups recorded yet.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Stream</th>
                    <th>Mode</th>
                    <th>State</th>
                    <th>Fee / billing</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pickups.map((pickup) => (
                    <tr key={pickup.id}>
                      <td>{pickup.accommodation_code}</td>
                      <td>{label(pickup.stream)}</td>
                      <td>{label(pickup.service_mode)}</td>
                      <td>{label(pickup.state)}</td>
                      <td>
                        {pickup.fee_cents
                          ? (pickup.fee_cents / 100).toLocaleString("en-CA", {
                              style: "currency",
                              currency: "CAD",
                            })
                          : "Included"}{" "}
                        · {label(pickup.billing_state)}
                      </td>
                      <td>
                        {canDispatch &&
                        !["completed", "cancelled"].includes(pickup.state) ? (
                          <form action={transitionGarbagePickupAction}>
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="pickupId"
                              value={pickup.id}
                            />
                            <input
                              type="hidden"
                              name="rowVersion"
                              value={pickup.row_version}
                            />
                            <label>
                              Next state
                              <select name="nextState">
                                {(
                                  {
                                    requested: ["scheduled", "cancelled"],
                                    scheduled: ["in_progress", "cancelled"],
                                    in_progress: ["completed", "cancelled"],
                                  } as Record<string, string[]>
                                )[pickup.state]?.map((state) => (
                                  <option key={state} value={state}>
                                    {label(state)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {pickup.state === "requested" ? (
                              <label>
                                Schedule at (UTC)
                                <input
                                  name="scheduledFor"
                                  type="datetime-local"
                                />
                              </label>
                            ) : null}
                            <label>
                              Note
                              <input name="note" maxLength={1000} />
                            </label>
                            <button type="submit">Update</button>
                          </form>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
