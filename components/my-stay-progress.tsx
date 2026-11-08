import Link from "next/link";

import { buildGuestStayProgress } from "@/lib/my-stay-hub/guest-progress.mjs";

import styles from "./my-stay-progress.module.css";

type GuestStay = {
  reservation: {
    id: string;
    status: string;
    arrivalDate: string;
    departureDate: string;
    campgroundLocalDate: string;
  };
  checkIn?: { checkedInAt?: string | null } | null;
  checkOut?: { checkedOutAt?: string | null } | null;
  documents: { confirmationNumber?: string | null };
};

type Action = { label: string; detail: string; href: string };

const stateLabels = {
  recorded: "Recorded",
  scheduled: "Scheduled only",
  pending: "Not yet recorded",
  needs_review: "Ask the office",
} as const;

export function MyStayProgress({
  stay,
  view,
}: Readonly<{ stay: GuestStay; view: "hub" | "details" }>) {
  const journey = buildGuestStayProgress(stay);
  const { reservation } = stay;
  const ownUrl = (path: string) =>
    `${path}?reservation=${encodeURIComponent(reservation.id)}`;
  const alternate =
    view === "hub"
      ? {
          label: "Full stay details",
          detail: "Rules, Wi-Fi and reservation information",
          href: ownUrl("/guest/stay"),
        }
      : {
          label: "Mobile stay hub",
          detail: "Recent events and assistance updates",
          href: ownUrl("/guest/hub"),
        };
  const assistance: Action = {
    label: "Ask for assistance",
    detail: "Send an internal campground service request",
    href: ownUrl("/guest/assistance"),
  };
  const documents: Action | null = stay.documents.confirmationNumber
    ? {
        label: "Confirmation & receipts",
        detail: "View documents actually issued for this reservation",
        href: `/booking/reservations/${encodeURIComponent(reservation.id)}/documents`,
      }
    : null;

  let actions: Action[];
  switch (reservation.status) {
    case "confirmed":
      actions = [
        {
          label: "Plan your arrival",
          detail: "Share arrival details for office review",
          href: ownUrl("/guest/arrival-planner"),
        },
        {
          label: "Change or cancellation options",
          detail: "Preview terms and request staff review only",
          href: ownUrl("/guest/reservation-options"),
        },
        assistance,
        documents ?? alternate,
      ];
      break;
    case "checked_in":
      actions = [
        assistance,
        alternate,
        {
          label: "Reservation review options",
          detail: "Ask the office about a change or cancellation",
          href: ownUrl("/guest/reservation-options"),
        },
        ...(documents ? [documents] : []),
      ];
      break;
    case "completed":
      actions = [
        documents ?? alternate,
        {
          label: "Share stay feedback",
          detail: "Open your guest feedback workspace",
          href: "/guest/feedback",
        },
        assistance,
      ];
      break;
    default:
      actions = [alternate, assistance];
  }

  return (
    <section className={styles.panel} aria-labelledby="guest-stay-progress">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>
            Build 225 · Your reservation at a glance
          </p>
          <h2 id="guest-stay-progress">{journey.headline}</h2>
          <p>
            {reservation.arrivalDate} to {reservation.departureDate} · dates
            follow the campground calendar.
          </p>
        </div>
        {journey.hasUnverifiedMilestone ? (
          <span className={styles.reviewNotice}>Staff verification needed</span>
        ) : null}
      </div>

      <ol className={styles.steps} aria-label="Reservation milestones">
        {journey.steps.map((item, index) => (
          <li key={item.id} className={styles.step}>
            <div className={styles.stepTop}>
              <span aria-hidden="true" className={styles.number}>
                {index + 1}
              </span>
              <strong>{item.label}</strong>
            </div>
            <span
              className={
                item.state === "recorded"
                  ? styles.recorded
                  : item.state === "scheduled"
                    ? styles.scheduled
                    : item.state === "needs_review"
                      ? styles.needsReview
                      : styles.pending
              }
            >
              {stateLabels[item.state]}
            </span>
            <p>{item.detail}</p>
          </li>
        ))}
      </ol>

      <nav aria-label="Priority guest actions" className={styles.actions}>
        <h3>What can we do next?</h3>
        <div className={styles.actionGrid}>
          {actions.map((item) => (
            <Link key={item.href} href={item.href} className={styles.action}>
              <strong>{item.label} →</strong>
              <small>{item.detail}</small>
            </Link>
          ))}
        </div>
      </nav>

      <p className={styles.note}>
        Scheduled dates are not proof of check-in, checkout, payment or access.
        These links only open guest pages; they do not automatically change a
        reservation or send a message.
      </p>
    </section>
  );
}
