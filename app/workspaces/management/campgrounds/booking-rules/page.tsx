import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  dateInTimeZone,
  evaluateBookingDateRules,
} from "@/lib/booking-rules/core.mjs";
import { getBookingRuleSnapshot } from "@/lib/booking-rules/postgres.mjs";

import {
  archiveBookingCalendarPeriodAction,
  createBookingCalendarPeriodAction,
  saveBookingRulePolicyAction,
} from "./actions";
import styles from "./booking-rules.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking calendar & date rules · iCamp",
  description:
    "Manage campground check-in/out times, booking lead windows, stay limits and holiday/season calendars.",
};

const weekdays = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

export default async function BookingRulesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    booking?: string;
    arrival?: string;
    departure?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/booking-rules";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return authorization?.permissions.includes("campground.configuration")
          ? { ...campground, authorization }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const snapshot = await getBookingRuleSnapshot(
    session.user.id,
    selected.campgroundId,
  );
  const policy = snapshot.policy;
  const today = dateInTimeZone(snapshot.campground.timezone);
  const activePeriods = snapshot.periods.filter((period) => period.isActive);

  let preview: ReturnType<typeof evaluateBookingDateRules> | null = null;
  let previewError: string | null = null;

  if (params.arrival && params.departure) {
    try {
      preview = evaluateBookingDateRules({
        policy,
        periods: snapshot.periods,
        bookingDate: params.booking || today,
        arrivalDate: params.arrival,
        departureDate: params.departure,
      });
    } catch (error) {
      previewError =
        error instanceof Error ? error.message : "Unable to evaluate dates.";
    }
  }

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management">Management</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span aria-hidden="true">/</span>
          <span>Booking calendar</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 032</p>
          <h1>Booking calendar &amp; date rules</h1>
          <p className="hero-panel__lead">
            Set campground-local check-in/out times, booking windows and stay
            limits, then classify dates as weekends, holidays and seasons
            without mixing pricing or live availability into this build.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}

        <section className="content-panel" aria-labelledby="scope-heading">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="scope-heading"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.selector}>
            <label className={styles.field}>
              <span>Campground</span>
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((campground) => (
                  <option
                    key={campground.campgroundId}
                    value={campground.campgroundId}
                  >
                    {campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open booking rules
            </button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Current policy"
            title="Booking date-rule summary"
            id="summary-heading"
            helpTopic="campground.structure"
            trailing={<span className="build-chip">Build 032</span>}
          />
          <div className={styles.metrics}>
            <div>
              <span>Timezone</span>
              <strong>{snapshot.campground.timezone}</strong>
            </div>
            <div>
              <span>Check-in / out</span>
              <strong>
                {policy.checkInTime} / {policy.checkOutTime}
              </strong>
            </div>
            <div>
              <span>Booking window</span>
              <strong>
                {policy.minimumBookingLeadDays}–{policy.maximumBookingLeadDays} d
              </strong>
            </div>
            <div>
              <span>Stay length</span>
              <strong>
                {policy.minimumStayNights}–{policy.maximumStayNights} nights
              </strong>
            </div>
            <div>
              <span>Active calendar periods</span>
              <strong>{activePeriods.length}</strong>
            </div>
          </div>
          <p className={styles.boundary}>
            Build 032 evaluates dates only. Build 035 will combine these rules
            with reservations, holds, management restrictions, turnover and
            seasonal assignments. Build 039 will own date pricing.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="policy-heading">
          <SectionHeading
            eyebrow="Campground defaults"
            title="Times, booking window & stay limits"
            id="policy-heading"
            helpTopic="campground.structure"
          />
          <form action={saveBookingRulePolicyAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <input type="hidden" name="rowVersion" value={policy.rowVersion} />

            <label className={styles.field}>
              <span>Check-in time</span>
              <input
                name="checkInTime"
                type="time"
                defaultValue={policy.checkInTime}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Check-out time</span>
              <input
                name="checkOutTime"
                type="time"
                defaultValue={policy.checkOutTime}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Minimum booking lead (days)</span>
              <input
                name="minimumBookingLeadDays"
                type="number"
                min="0"
                max="365"
                defaultValue={policy.minimumBookingLeadDays}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Maximum booking lead (days)</span>
              <input
                name="maximumBookingLeadDays"
                type="number"
                min="1"
                max="1095"
                defaultValue={policy.maximumBookingLeadDays}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Minimum stay (nights)</span>
              <input
                name="minimumStayNights"
                type="number"
                min="1"
                max="365"
                defaultValue={policy.minimumStayNights}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Maximum stay (nights)</span>
              <input
                name="maximumStayNights"
                type="number"
                min="1"
                max="365"
                defaultValue={policy.maximumStayNights}
                required
              />
            </label>

            <fieldset className={styles.weekendFieldset}>
              <legend>Weekend nights</legend>
              <div className={styles.weekendGrid}>
                {weekdays.map((day) => (
                  <label key={day.value}>
                    <input
                      type="checkbox"
                      name="weekendIsoDays"
                      value={day.value}
                      defaultChecked={policy.weekendIsoDays.includes(day.value)}
                    />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.actions}>
              <button className="primary-button" type="submit">
                Save booking rules
              </button>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="calendar-heading">
          <SectionHeading
            eyebrow="Holiday & season calendar"
            title="Named date periods"
            id="calendar-heading"
            helpTopic="campground.structure"
          />
          <p className={styles.boundary}>
            Seasons may not overlap other active seasons. Holidays may overlap a
            season. Period rows are append-preserved: archive a mistaken row and
            create its replacement rather than rewriting historical evidence.
          </p>

          <form
            action={createBookingCalendarPeriodAction}
            className={styles.formGrid}
          >
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label className={styles.field}>
              <span>Type</span>
              <select name="periodKind" defaultValue="season">
                <option value="season">Season</option>
                <option value="holiday">Holiday</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Code</span>
              <input
                name="code"
                placeholder="summer-peak"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxLength={64}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Name</span>
              <input name="displayName" maxLength={120} required />
            </label>
            <label className={styles.field}>
              <span>Start date</span>
              <input name="startsOn" type="date" required />
            </label>
            <label className={styles.field}>
              <span>End date</span>
              <input name="endsOn" type="date" required />
            </label>
            <label className={styles.field}>
              <span>Minimum stay override</span>
              <input name="minimumStayNights" type="number" min="1" max="365" />
            </label>
            <label className={styles.field}>
              <span>Maximum stay override</span>
              <input name="maximumStayNights" type="number" min="1" max="365" />
            </label>
            <label className={styles.field + " " + styles.full}>
              <span>Operations note</span>
              <textarea name="notes" maxLength={1000} />
            </label>
            <div className={styles.actions}>
              <button className="primary-button" type="submit">
                Add calendar period
              </button>
            </div>
          </form>

          <div className={styles.periodGrid}>
            {snapshot.periods.map((period) => (
              <article className={styles.periodCard} key={period.id}>
                <header>
                  <div>
                    <p className={styles.kicker}>
                      {period.periodKind} · {period.code}
                    </p>
                    <h3>{period.displayName}</h3>
                  </div>
                  <span className={styles.state}>
                    {period.isActive ? "active" : "archived"}
                  </span>
                </header>
                <p>
                  {period.startsOn} through {period.endsOn} · row rev{" "}
                  {period.rowVersion}
                </p>
                <p>
                  Stay override: {period.minimumStayNights ?? "default"}–{" "}
                  {period.maximumStayNights ?? "default"} nights
                </p>
                {period.notes ? <p>{period.notes}</p> : null}
                {period.isActive ? (
                  <form action={archiveBookingCalendarPeriodAction}>
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={selected.campgroundId}
                    />
                    <input type="hidden" name="periodId" value={period.id} />
                    <input
                      type="hidden"
                      name="rowVersion"
                      value={period.rowVersion}
                    />
                    <button className="primary-button" type="submit">
                      Archive period
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
            {snapshot.periods.length === 0 ? (
              <p className={styles.empty}>No holiday or season periods yet.</p>
            ) : null}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="preview-heading">
          <SectionHeading
            eyebrow="Rule preview"
            title="Test a proposed stay"
            id="preview-heading"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.formGrid}>
            <input
              type="hidden"
              name="campground"
              value={selected.campgroundId}
            />
            <label className={styles.field}>
              <span>Booking date</span>
              <input
                type="date"
                name="booking"
                defaultValue={params.booking || today}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Arrival</span>
              <input
                type="date"
                name="arrival"
                defaultValue={params.arrival}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Departure</span>
              <input
                type="date"
                name="departure"
                defaultValue={params.departure}
                required
              />
            </label>
            <div className={styles.actions}>
              <button className="primary-button" type="submit">
                Evaluate dates
              </button>
            </div>
          </form>

          {previewError ? (
            <div className={styles.previewBad}>{previewError}</div>
          ) : preview ? (
            <div
              className={preview.eligible ? styles.previewGood : styles.previewBad}
            >
              <strong>
                {preview.eligible
                  ? "Date rules pass."
                  : "Date rules need attention."}
              </strong>
              <p>
                {preview.nights} nights · {preview.leadDays} days lead ·{" "}
                {preview.weekendNights} weekend nights · effective stay{" "}
                {preview.effectiveMinimumStay}–{preview.effectiveMaximumStay} nights
              </p>
              <p>
                Check-in {preview.checkInTime} · check-out {preview.checkOutTime}
              </p>
              {preview.seasonNames.length > 0 ? (
                <p>Seasons: {preview.seasonNames.join(", ")}</p>
              ) : null}
              {preview.holidayNames.length > 0 ? (
                <p>Holidays: {preview.holidayNames.join(", ")}</p>
              ) : null}
              {preview.issues.length > 0 ? (
                <ul>
                  {preview.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className={styles.empty}>
              Enter booking, arrival and departure dates to preview the current
              rules before later availability and pricing builds consume them.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
