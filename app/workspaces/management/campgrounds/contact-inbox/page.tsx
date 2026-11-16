import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  listContactTasks,
  listInboundContactOrigins,
} from "@/lib/release/build257-contact-inbox-postgres.mjs";
import {
  checkContactConsentAction,
  contactTaskAction,
  createContactInboxAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Consent-aware contact inbox · iCamp",
  robots: { index: false, follow: false },
};
const path = "/workspaces/management/campgrounds/contact-inbox";
const contactKinds = [
  ["general_request", "General request"],
  ["staff_transfer", "Staff telephone / IVR transfer"],
  ["booking_question", "Booking question"],
  ["consent_help", "Messaging consent help"],
] as const;
const roles = [
  ["front_desk", "Front desk"],
  ["communications_reviewer", "Communications reviewer"],
  ["campground_owner", "Campground owner"],
] as const;

export default async function ContactInboxPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; result?: string }>;
}>) {
  const session = await requireStaff(path);
  if (session.assuranceLevel !== "aal2")
    redirect("/auth/mfa?next=" + encodeURIComponent(path));
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (item) => {
        const grant = await getCampgroundAuthorization(
          session.user.id,
          item.campgroundId,
        );
        return grant?.permissions.includes("communications.read")
          ? { ...item, grant }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (
    !allowed.length ||
    (params.campground &&
      !allowed.some((item) => item.campgroundId === params.campground))
  )
    redirect("/auth/not-authorized");
  const selected =
    allowed.find((item) => item.campgroundId === params.campground) ??
    allowed[0];
  const canManage = selected.grant.permissions.includes(
    "communications.manage",
  );
  const [report, originals] = await Promise.all([
    listContactTasks({
      actorUserId: session.user.id,
      campgroundId: selected.campgroundId,
    }).catch(() => ({
      status: "HOLD_BUILD257_DATABASE_MIGRATION_OR_RLS",
      tasks: [],
      holds: [],
      personalDataShared: false as const,
      outboundSent: false as const,
    })),
    canManage
      ? listInboundContactOrigins({
          actorUserId: session.user.id,
          campgroundId: selected.campgroundId,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);
  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel">
          <p className="eyebrow">Build 257 · Slave Application Shell</p>
          <h1>Consent-aware contact inbox and staff handoff</h1>
          <p className="hero-panel__lead">
            iCamp handles its own campground SMS, telephone and IVR staff
            requests. Protocol 1.1 permits additive local releases without
            updating the other six applications. Legacy 1.0 source-health
            capabilities remain compatible; new cross-app actions remain HOLD
            until separately authenticated.
          </p>
        </section>
        <section className="content-panel">
          <p role="status">
            <strong>{report.status}</strong> · No automatic external message
            delivery · Master connection HOLD
          </p>
          {params.result ? (
            <p role="status">Last review: {params.result}</p>
          ) : null}
          <p>Campground: {selected.campgroundId}</p>
          <p>
            <Link href="/workspaces/management/campgrounds/signed-event-custody">
              Signed-event and Master security custody
            </Link>
            {" · "}
            <Link href="/integration/comms-hub">
              Comms Hub integration guidance
            </Link>
          </p>
          <p>
            SMS STOP/START/HELP continues through the existing canonical
            consent gateway. Nothing here stores a customer phone number,
            message body, raw DTMF digits or provider secret.
          </p>
        </section>
        <section className="content-panel">
          <h2>Original inbound provider events</h2>
          <p>
            Intake selects only already-recorded, campground-scoped inbound
            gateway events. An unavailable or unverified original stays on
            manual review, with no synthetic incoming message.
          </p>
          {canManage ? (
            <form action={createContactInboxAction}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label>
                Original event
                <select
                  name="providerEventId"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Choose a real inbound event
                  </option>
                  {originals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.channel} · {item.eventType} · {item.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Contact request type
                <select name="contactKind" defaultValue="general_request">
                  {contactKinds.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Staff role queue
                <select name="assignedRole" defaultValue="front_desk">
                  {roles
                    .filter(
                      ([value]) =>
                        value !== "campground_owner" ||
                        selected.grant.roleCodes.includes("owner_admin"),
                    )
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <button type="submit" disabled={!originals.length}>
                Record source-bound staff task
              </button>
            </form>
          ) : (
            <p>Current staff access is read-only.</p>
          )}
          {!originals.length ? (
            <p>No verified inbound provider events available for intake.</p>
          ) : null}
        </section>
        <section className="content-panel">
          <h2>Local contact and transfer tasks</h2>
          {report.tasks.length === 0 ? (
            <p>No original contact tasks admitted.</p>
          ) : (
            <ul>
              {report.tasks.map((task) => {
                const staffAllowed =
                  task.assignedRole === "front_desk" ||
                  (task.assignedRole === "communications_reviewer" &&
                    canManage) ||
                  (task.assignedRole === "campground_owner" &&
                    selected.grant.roleCodes.includes("owner_admin"));
                const resolved = task.state === "resolve";
                return (
                  <li key={task.id}>
                    <strong>{task.kind.replaceAll("_", " ")}</strong>
                    {" · "}
                    {task.channel} · {task.assignedRole.replaceAll("_", " ")}
                    {" · "}
                    {task.state} · {task.at}
                    <p>
                      <code>{task.id}</code>
                    </p>
                    {staffAllowed && !resolved ? (
                      <>
                        <form action={contactTaskAction}>
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="inboxId"
                            value={task.id}
                          />
                          <button
                            type="submit"
                            name="action"
                            value="acknowledge"
                          >
                            Acknowledge locally
                          </button>
                          {canManage ? (
                            <button
                              type="submit"
                              name="action"
                              value="escalate"
                            >
                              Queue Master handoff HOLD
                            </button>
                          ) : null}
                          {canManage &&
                          (selected.grant.roleCodes.includes("owner_admin") ||
                            selected.grant.permissions.includes(
                              "campground.operations.manage",
                            )) ? (
                            <button
                              type="submit"
                              name="action"
                              value="resolve"
                            >
                              Resolve locally
                            </button>
                          ) : null}
                        </form>
                        <form action={checkContactConsentAction}>
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="inboxId"
                            value={task.id}
                          />
                          <button type="submit">
                            Check current SMS follow-up consent
                          </button>
                        </form>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="content-panel">
          <h2>Protocol 1.1 — independent release handoff</h2>
          <p>
            The queue stores only non-sensitive event identity and local
            review state. If a Master is unavailable, ordinary campground
            operations continue. New capabilities remain HOLD on 1.0 peers;
            no cross-app database access, raw-secret sync or implicit 7-app
            release dependency is introduced.
          </p>
          {report.holds.map((item) => (
            <p key={item.id}>
              {item.target} · {item.protocol} · {item.state} · {item.at}
            </p>
          ))}
          {!report.holds.length ? (
            <p>No Master handoffs queued.</p>
          ) : null}
          <p>
            Consent eligibility is not delivery approval. Outbound SMS/MMS
            must pass the existing provider gateway and independently
            authenticated consent/suppression checks at actual send time.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
