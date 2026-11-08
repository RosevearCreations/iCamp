import Link from "next/link";

import {
  buildGuestArrivalGuide,
  type ArrivalGuideBundle,
  type ArrivalGuideStay,
} from "@/lib/arrival-planner/guest-arrival-guide.mjs";

import styles from "./guest-arrival-guide.module.css";

export function GuestArrivalGuide({
  stay,
  arrival,
  arrivalAvailable = true,
}: Readonly<{
  stay: ArrivalGuideStay;
  arrival: ArrivalGuideBundle | null;
  arrivalAvailable?: boolean;
}>) {
  const guide = buildGuestArrivalGuide({ stay, arrival, arrivalAvailable });

  return (
    <section
      className={styles.panel}
      aria-labelledby="guest-arrival-guide-heading"
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>Build 226 · Arrival essentials</p>
          <h2 id="guest-arrival-guide-heading">{guide.headline}</h2>
          <p>
            Current reservation and campground guidance. Always confirm final
            arrival arrangements with the office.
          </p>
        </div>
        <span className={styles.badge}>Read-only guidance</span>
      </div>

      <dl
        className={styles.facts}
        aria-label="Arrival readiness and instructions"
      >
        {guide.facts.map((fact) => (
          <div className={styles.fact} key={fact.id}>
            <dt>{fact.title}</dt>
            <dd>{fact.detail}</dd>
          </div>
        ))}
      </dl>

      {guide.campgroundGuidance ? (
        <div className={styles.guidance}>
          <h3>Campground-provided instructions</h3>
          <p>{guide.campgroundGuidance}</p>
        </div>
      ) : (
        <p className={styles.unknown} role="status">
          No current guest-instructions summary is published here. Contact the
          office for arrival directions and any local requirements.
        </p>
      )}

      {guide.notices.length ? (
        <div className={styles.notices} role="status">
          <h3>Items to verify with staff</h3>
          <ul>
            {guide.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <nav className={styles.links} aria-label="Arrival and help shortcuts">
        {guide.actions.map((action) => (
          <Link key={action.href} href={action.href}>
            {action.label} →
          </Link>
        ))}
      </nav>
      <p className={styles.note}>{guide.assistanceHint}</p>
      <p className={styles.note}>
        A plan or staff review does not authorize arrival, early entry, payment
        approval or gate access. This panel cannot change your booking or send
        external messages.
      </p>
    </section>
  );
}
