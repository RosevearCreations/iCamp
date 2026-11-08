import Link from "next/link";

import styles from "./booking-journey.module.css";

const stages = [
  { id: "discover", label: "Find a stay", detail: "Dates and accommodation" },
  {
    id: "review",
    label: "Review suitability",
    detail: "Features, rules and quote",
  },
  {
    id: "checkout",
    label: "Checkout details",
    detail: "Guest, party and acceptance",
  },
  {
    id: "reservation",
    label: "Reservation status",
    detail: "Payment and confirmation",
  },
] as const;

type Stage = (typeof stages)[number]["id"];

export function BookingJourney({
  current,
  mapHref,
  detailHref,
}: Readonly<{
  current: Stage;
  mapHref: string;
  detailHref?: string;
}>) {
  const activeIndex = stages.findIndex((stage) => stage.id === current);
  return (
    <nav className={styles.journey} aria-label="Booking progress">
      <p className={styles.intro}>Your booking journey</p>
      <ol className={styles.stages}>
        {stages.map((stage, index) => {
          const href =
            index < activeIndex
              ? stage.id === "discover"
                ? mapHref
                : stage.id === "review"
                  ? detailHref
                  : undefined
              : undefined;
          return (
            <li
              key={stage.id}
              className={index === activeIndex ? styles.active : styles.stage}
              aria-current={index === activeIndex ? "step" : undefined}
            >
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <strong>
                  {href ? <Link href={href}>{stage.label}</Link> : stage.label}
                </strong>
                <small>{stage.detail}</small>
                {index === activeIndex ? (
                  <small className={styles.current}>Current step</small>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const checkoutSections = [
  ["checkout-contact", "Contact"],
  ["checkout-party", "Party"],
  ["checkout-compatibility", "Suitability"],
  ["checkout-addons", "Extras"],
  ["checkout-rules", "Review & submit"],
] as const;

export function CheckoutSectionLinks() {
  return (
    <nav className={styles.jumpNav} aria-label="Checkout sections">
      <strong>Complete your details</strong>
      <p>
        Move through each section, then review the campground rules before
        submitting.
      </p>
      <ol>
        {checkoutSections.map(([id, label], index) => (
          <li key={id}>
            <a href={`#${id}`}>
              {index + 1}. {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
