import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import {
  getWaterfrontDashboard,
  getWaterfrontPermissions,
} from "@/lib/waterfront-swim/postgres.mjs";

import {
  publishWaterfrontZoneAction,
  recordWaterfrontEventAction,
  recordWaterfrontTrainingAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Waterfront swimming & beach safety · iCamp",
  robots: { index: false, follow: false },
};

const pretty = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (character) => character.toUpperCase());

export default async function WaterfrontSafetyPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/waterfront-safety";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const available = (
    await Promise.all(
      assigned.map(async (campground) => ({
        ...campground,
        permissions: await getWaterfrontPermissions(
          session.user.id,
          campground.campgroundId,
        ),
      })),
    )
  ).filter((campground) => Object.values(campground.permissions).some(Boolean));
  if (!available.length) redirect("/auth/not-authorized");
  const selected =
    available.find((item) => item.campgroundId === params.campground) ??
    available[0];
  const {
    facilities,
    zones,
    training,
    events,
    rules,
    staff,
    reservations,
    permissions,
    campground,
  } = await getWaterfrontDashboard(session.user.id, selected.campgroundId);

  const latestZoneKeys = new Set<string>();
  const activeZones = zones.filter((zone) => {
    const key = `${zone.asset_id}:${zone.zone_code}`;
    if (latestZoneKeys.has(key)) return false;
    latestZoneKeys.add(key);
    return true;
  });
  const rows = activeZones.map((zone) => {
    const beach = facilities.find((item) => item.id === zone.asset_id);
    const decision = events.find(
      (event) =>
        event.asset_id === zone.asset_id &&
        event.zone_code === zone.zone_code &&
        ["closure", "reopen"].includes(event.kind),
    );
    return { zone, beach, decision, closed: decision?.kind === "closure" };
  });

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Waterfront safety</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 085 · Beach, lake & ocean swimming</p>
          <h1>Waterfront swimming zones & safety register</h1>
          <p className="hero-panel__lead">
            Versioned beach zones, locally approved hours, trained staff checks,
            guest-rule acknowledgements, on-site hazard observations and
            independently reviewed swimming closures.
          </p>
          <p>
            <strong>Life-safety boundary:</strong> Software never replaces a
            lifeguard, water-quality testing, weather and current monitoring,
            rescue personnel, physical closure or emergency dispatch. Operators
            must follow the applicable local rules and current on-site emergency
            plan.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            {params.saved}
          </p>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            id="waterfront-status"
            title="Campground, beaches & swimming status"
            eyebrow="Physical facility and swimming rules are separate"
            helpTopic="waterfront.swim"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {available.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open campground
            </button>
          </form>
          <p>
            Operating hours use <strong>{campground.timezone}</strong>. Swimming
            is permitted only within configured local hours, when the beach is
            operational and no swimming closure is active.
          </p>
          {facilities.length ? (
            <ul>
              {facilities.map((beach) => (
                <li key={beach.id}>
                  <strong>{beach.display_name}</strong> · Physical facility:{" "}
                  {pretty(beach.operating_state)}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No active registered beach facilities exist. Add a beach under
              operational assets first.
            </p>
          )}
          {rows.length ? (
            <ul>
              {rows.map(({ zone, beach, closed }) => (
                <li key={zone.id}>
                  <strong>
                    {beach?.display_name ?? "Beach"} / {zone.zone_name}
                  </strong>{" "}
                  · {zone.zone_code}
                  {` · v${zone.version_number} · ${zone.opens_at.slice(0, 5)}–${zone.closes_at.slice(0, 5)} · max ${zone.maximum_swimmers} swimmers`}
                  {" · "}
                  <strong>
                    {closed
                      ? "SWIMMING CLOSED"
                      : "No active recorded swimming closure (not a safety certification)"}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No published swimming zones. Publication requires a current
              waterfront rule version.
            </p>
          )}
          <p>
            <Link href="/workspaces/management/campgrounds/rules">
              Manage waterfront rules & guest acknowledgements
            </Link>
            {" · "}
            <Link href="/workspaces/management/campgrounds/enforcement">
              Formal warning/suspension register
            </Link>
          </p>
        </section>

        {permissions.manage ? (
          <section className="content-panel">
            <SectionHeading
              id="waterfront-publish"
              title="Publish swimming-zone rules"
              eyebrow="Manager · immutable operating version"
              helpTopic="waterfront.swim"
            />
            <p>
              Confirm the actual marked boundary and local operating
              requirements before publication. Reusing a zone code creates a new
              version; publishing updated guest rules requires a new zone
              version.
            </p>
            <form
              action={publishWaterfrontZoneAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Registered beach
                <select name="assetId" required>
                  {facilities.map((beach) => (
                    <option key={beach.id} value={beach.id}>
                      {beach.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Zone code (stable ID, e.g. NORTH_SWIM)
                <input
                  name="zoneCode"
                  pattern="[A-Za-z][A-Za-z0-9_-]{2,31}"
                  required
                  maxLength={32}
                />
              </label>
              <label>
                Zone name
                <input name="zoneName" minLength={4} maxLength={120} required />
              </label>
              <label>
                Current published waterfront rule
                <select name="ruleVersionId" required>
                  {rules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.title} · v{rule.version_number}
                      {rule.facility_id ? " · facility-specific" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Physical swimming boundary description
                <textarea
                  name="boundaryDescription"
                  rows={3}
                  minLength={30}
                  maxLength={2000}
                  required
                  placeholder="Describe the visible markers, shoreline endpoints, depth limits and excluded areas."
                />
              </label>
              <fieldset>
                <legend>Open days · {campground.timezone}</legend>
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day, index) => (
                  <label
                    key={day}
                    style={{
                      display: "inline-flex",
                      gap: "0.4rem",
                      marginRight: "0.8rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="operatingDays"
                      value={index + 1}
                      defaultChecked
                    />
                    {day}
                  </label>
                ))}
              </fieldset>
              <label>
                Opening time (local)
                <input
                  name="openTime"
                  type="time"
                  defaultValue="09:00"
                  required
                />
              </label>
              <label>
                Closing time (same day, local)
                <input
                  name="closeTime"
                  type="time"
                  defaultValue="19:00"
                  required
                />
              </label>
              <label>
                Maximum swimmers
                <input
                  name="maximumSwimmers"
                  type="number"
                  min="1"
                  max="10000"
                  defaultValue="30"
                  required
                />
              </label>
              <label>
                Minimum unaccompanied swimmer age
                <input
                  name="minimumUnaccompaniedAge"
                  type="number"
                  min="0"
                  max="25"
                  defaultValue="12"
                  required
                />
              </label>
              <label>
                Minimum adult supervisor age
                <input
                  name="minimumSupervisorAge"
                  type="number"
                  min="13"
                  max="99"
                  defaultValue="18"
                  required
                />
              </label>
              <label>
                Maximum underage swimmers per adult
                <input
                  name="maximumChildrenPerSupervisor"
                  type="number"
                  min="1"
                  max="50"
                  defaultValue="2"
                  required
                />
              </label>
              <label>
                Locally approved hazard, rescue and emergency instructions
                <textarea
                  name="hazardInstructions"
                  rows={3}
                  minLength={30}
                  maxLength={2000}
                  required
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={!facilities.length || !rules.length}
              >
                Publish new immutable zone version
              </button>
            </form>
          </section>
        ) : null}

        {permissions.manage ? (
          <section className="content-panel">
            <SectionHeading
              id="waterfront-training"
              title="Verify or revoke waterfront staff training"
              eyebrow="Independent manager review"
              helpTopic="waterfront.swim"
            />
            <p>
              Check real records, rescue readiness, role obligations and expiry
              outside the application. A manager cannot verify their own
              training. Role permissions never prove competence.
            </p>
            <form
              action={recordWaterfrontTrainingAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Beach
                <select name="assetId">
                  {facilities.map((beach) => (
                    <option key={beach.id} value={beach.id}>
                      {beach.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Currently assigned staff
                <select name="staffUserId">
                  {staff.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Decision
                <select name="decision">
                  <option value="verify">Verify training</option>
                  <option value="revoke">Revoke training</option>
                </select>
              </label>
              <label>
                Training/certificate source reference
                <input
                  name="trainingReference"
                  minLength={8}
                  maxLength={400}
                  required
                />
              </label>
              <label>
                Expiry (required for verification)
                <input name="expiresAt" type="datetime-local" />
              </label>
              <label>
                Independent review note
                <textarea
                  name="note"
                  rows={2}
                  minLength={12}
                  maxLength={2000}
                  required
                />
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={!facilities.length || !staff.length}
              >
                Record training decision
              </button>
            </form>
            <h3>Latest recorded training decisions</h3>
            <ul>
              {training.slice(0, 12).map((item) => (
                <li key={item.id}>
                  {item.staff_email ?? item.staff_user_id} ·{" "}
                  {pretty(item.decision)} · {item.training_reference}
                  {item.expires_at
                    ? ` · expires ${new Date(item.expires_at).toLocaleDateString("en-CA")}`
                    : " · revoked"}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {permissions.monitor ? (
          <section className="content-panel">
            <SectionHeading
              id="waterfront-observations"
              title="Record admission, hazards or an immediate swimming closure"
              eyebrow="Assigned waterfront monitors"
              helpTopic="waterfront.swim"
            />
            <p>
              Incident and closure reporting do not wait for training
              verification. Admission checks, guest warnings/removals and
              reopening requests require current independently verified
              training. Choosing <strong>Close swimming immediately</strong>{" "}
              does not place physical barriers or dispatch help.
            </p>
            {rows.map(({ zone, beach, closed }) => (
              <details key={zone.id} className="content-panel">
                <summary>
                  <strong>
                    {beach?.display_name ?? "Beach"} · {zone.zone_name}
                  </strong>{" "}
                  · v{zone.version_number}
                  {closed ? " · SWIMMING CLOSED" : " · record observation"}
                </summary>
                <form
                  action={recordWaterfrontEventAction}
                  className={styles.formGrid}
                >
                  <input
                    type="hidden"
                    name="campgroundId"
                    value={selected.campgroundId}
                  />
                  <input type="hidden" name="id" value={randomUUID()} />
                  <input type="hidden" name="assetId" value={zone.asset_id} />
                  <input type="hidden" name="zoneCode" value={zone.zone_code} />
                  <input type="hidden" name="zoneVersionId" value={zone.id} />
                  <label>
                    Observation or action
                    <select name="kind">
                      <option value="entry_check">
                        Guest admission / refusal
                      </option>
                      <option value="warning">On-site safety warning</option>
                      <option value="removal">
                        Removal from swimming zone
                      </option>
                      <option value="incident">
                        Hazard or incident observation
                      </option>
                      <option value="closure">
                        Close swimming immediately
                      </option>
                      <option value="reopen_request">
                        Request independent reopening
                      </option>
                    </select>
                  </label>
                  <label>
                    Guest reservation (required for admission/warning/removal)
                    <select name="reservationId">
                      <option value="">Facility-only action, no guest</option>
                      {reservations.map((stay) => (
                        <option key={stay.id} value={stay.id}>
                          {stay.accommodation_code} · {stay.status} ·{" "}
                          {stay.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Swimmers observed
                    <input
                      name="swimmerCount"
                      type="number"
                      min="0"
                      max="10000"
                      defaultValue="0"
                    />
                  </label>
                  <label>
                    Underage swimmers
                    <input
                      name="underageCount"
                      type="number"
                      min="0"
                      max="10000"
                      defaultValue="0"
                    />
                  </label>
                  <label>
                    Adult supervisors
                    <input
                      name="supervisorCount"
                      type="number"
                      min="0"
                      max="10000"
                      defaultValue="0"
                    />
                  </label>
                  <label>
                    Entry decision
                    <select name="admitted">
                      <option value="no">Refuse</option>
                      <option value="yes">Admit only after all checks</option>
                    </select>
                  </label>
                  <label>
                    Swimmer/supervisor ages checked on site
                    <select name="agesVerified">
                      <option value="no">Not checked</option>
                      <option value="yes">Checked against zone limits</option>
                    </select>
                  </label>
                  <label>
                    Observed real-time hazard level (for admission)
                    <select name="hazardLevel">
                      <option value="unsafe">Unsafe</option>
                      <option value="caution">Caution</option>
                      <option value="normal">
                        Normal after real-world checks
                      </option>
                    </select>
                  </label>
                  <label>
                    Incident/closure hazard category
                    <select name="hazardType">
                      <option value="weather">Weather</option>
                      <option value="water_quality">Water quality</option>
                      <option value="current">Current / surf</option>
                      <option value="wildlife">Wildlife</option>
                      <option value="infrastructure">Infrastructure</option>
                      <option value="staffing">Staffing</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Evidence reference (optional except independent reopening)
                    <input name="evidenceReference" maxLength={400} />
                  </label>
                  <label>
                    Observed facts, reason and action taken
                    <textarea
                      name="note"
                      rows={3}
                      minLength={12}
                      maxLength={2000}
                      required
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    Record immutable waterfront event
                  </button>
                </form>
              </details>
            ))}
            {!rows.length ? (
              <p>
                Publish a waterfront swimming zone before recording
                observations.
              </p>
            ) : null}
          </section>
        ) : null}

        {permissions.manage ? (
          <section className="content-panel">
            <SectionHeading
              id="waterfront-reopen"
              title="Independent management reopening"
              eyebrow="Manager · separate from closer and requester"
              helpTopic="waterfront.swim"
            />
            <p>
              Only review a zone after someone else has requested reopening and
              field evidence is available. Canonical beach operations must
              separately be restored to operational status.
            </p>
            {rows
              .filter((item) => item.closed)
              .map(({ zone, beach }) => (
                <form
                  key={zone.id}
                  action={recordWaterfrontEventAction}
                  className={styles.formGrid}
                >
                  <input
                    type="hidden"
                    name="campgroundId"
                    value={selected.campgroundId}
                  />
                  <input type="hidden" name="id" value={randomUUID()} />
                  <input type="hidden" name="assetId" value={zone.asset_id} />
                  <input type="hidden" name="zoneCode" value={zone.zone_code} />
                  <input type="hidden" name="zoneVersionId" value={zone.id} />
                  <input type="hidden" name="kind" value="reopen" />
                  <p>
                    <strong>
                      {beach?.display_name ?? "Beach"} · {zone.zone_name}
                    </strong>{" "}
                    · swimming closed
                  </p>
                  <label>
                    Independent inspection/source evidence reference
                    <input
                      name="evidenceReference"
                      minLength={8}
                      maxLength={400}
                      required
                    />
                  </label>
                  <label>
                    Review decision, observations and verified corrective work
                    <textarea
                      name="note"
                      rows={3}
                      minLength={12}
                      maxLength={2000}
                      required
                    />
                  </label>
                  <button type="submit" className="primary-button">
                    Approve swimming reopening
                  </button>
                </form>
              ))}
            {!rows.some((item) => item.closed) ? (
              <p>No active swimming closures are awaiting review.</p>
            ) : null}
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            id="waterfront-history"
            title="Immutable waterfront event history"
            eyebrow="Audit trail · newest first"
            helpTopic="waterfront.swim"
          />
          {events.length ? (
            <ul>
              {events.slice(0, 100).map((event) => (
                <li key={event.id}>
                  <strong>{pretty(event.kind)}</strong> · {event.zone_code} ·
                  {` ${new Date(event.occurred_at).toLocaleString("en-CA", { timeZone: campground.timezone })}`}
                  {event.admitted !== null
                    ? event.admitted
                      ? " · admitted"
                      : " · refused"
                    : ""}
                  {event.hazard_type ? ` · ${pretty(event.hazard_type)}` : ""} ·{" "}
                  {event.note}
                </li>
              ))}
            </ul>
          ) : (
            <p>No waterfront events recorded.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
