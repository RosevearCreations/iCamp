"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CampgroundModule = {
  title: string;
  subtitle: string;
  category:
    "Bookings" | "Guest services" | "Property" | "Administration" | "Analytics";
  icon: string;
  href: string;
};

const categories = [
  "All tools",
  "Bookings",
  "Guest services",
  "Property",
  "Analytics",
  "Administration",
] as const;

export function ManagementModuleFinder({
  modules,
  campgroundId,
}: {
  modules: CampgroundModule[];
  campgroundId: string;
}) {
  const [term, setTerm] = useState("");
  const [category, setCategory] =
    useState<(typeof categories)[number]>("All tools");
  const filtered = useMemo(() => {
    const query = term.trim().toLocaleLowerCase();
    return modules.filter(
      (item) =>
        (category === "All tools" || item.category === category) &&
        (!query ||
          `${item.title} ${item.subtitle} ${item.category}`
            .toLocaleLowerCase()
            .includes(query)),
    );
  }, [category, modules, term]);

  return (
    <section className="content-panel ops-detail-card camp-command__finder">
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Campground workspaces</p>
          <h2>Everything in its place</h2>
        </div>
        <span className="ops-pill">
          {filtered.length} of {modules.length} accessible tools
        </span>
      </div>
      <div className="camp-command__filters">
        <label>
          Search workspaces
          <input
            type="search"
            placeholder="Find reservations, maintenance, guests…"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as (typeof categories)[number])
            }
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length ? (
        <div className="camp-command__modules">
          {filtered.map((item) => (
            <Link
              href={`${item.href}${item.href.includes("?") ? "&" : "?"}campground=${encodeURIComponent(campgroundId)}`}
              className="camp-command__module"
              key={item.href}
            >
              <span className="camp-command__module-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>
                <small>{item.category}</small>
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </span>
              <b aria-hidden="true">↗</b>
            </Link>
          ))}
        </div>
      ) : (
        <p className="ops-inline-note" role="status">
          No accessible workspaces match that search. Try another category or
          keyword.
        </p>
      )}
    </section>
  );
}
