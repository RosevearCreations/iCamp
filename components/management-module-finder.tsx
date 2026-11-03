"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  CommandView,
  CommandCategory,
  CommandPerspective,
  CommandDensity,
} from "@/lib/command-centre/layout-postgres.mjs";
import {
  saveCommandViewAction,
  deleteCommandViewAction,
} from "@/app/workspaces/management/command/actions";

export type CampgroundModule = {
  title: string;
  subtitle: string;
  category:
    "Bookings" | "Guest services" | "Property" | "Administration" | "Analytics";
  icon: string;
  href: string;
};

const categories: CommandCategory[] = [
  "All tools",
  "Bookings",
  "Guest services",
  "Property",
  "Analytics",
  "Administration",
];
const perspectives: { id: CommandPerspective; label: string }[] = [
  { id: "all", label: "All" },
  { id: "management", label: "Management" },
  { id: "it", label: "I.T." },
  { id: "status", label: "Status" },
  { id: "statistics", label: "Statistics" },
];
const initialKpis = ["sites", "arrivals", "work_orders", "financial"];
const names: Record<string, string> = {
  sites: "Active sites",
  arrivals: "Upcoming arrivals",
  work_orders: "Maintenance attention",
  financial: "Financial review flags",
};
function modulePerspective(item: CampgroundModule): CommandPerspective {
  if (item.category === "Analytics") return "statistics";
  if (
    item.href.includes("/security/") ||
    item.href.includes("/status") ||
    item.title.toLowerCase().includes("readiness")
  )
    return "status";
  if (
    item.href.includes("/settings/") ||
    item.href.includes("/integration/") ||
    item.href === "/status"
  )
    return "it";
  return "management";
}

export function ManagementModuleFinder({
  modules,
  campgroundId,
  savedViews = [],
  activeView = null,
  preferencesAvailable = true,
  sourceAsOf,
}: {
  modules: CampgroundModule[];
  campgroundId: string;
  savedViews?: CommandView[];
  activeView?: CommandView | null;
  preferencesAvailable?: boolean;
  sourceAsOf?: string;
}) {
  const [term, setTerm] = useState(activeView?.searchTerm ?? "");
  const [category, setCategory] = useState<CommandCategory>(
    activeView?.category ?? "All tools",
  );
  const [perspective, setPerspective] = useState<CommandPerspective>(
    activeView?.perspective ?? "all",
  );
  const [density, setDensity] = useState<CommandDensity>(
    activeView?.density ?? "comfortable",
  );
  const [favorites, setFavorites] = useState<string[]>(
    activeView?.favoriteHrefs ?? [],
  );
  const [kpiOrder, setKpiOrder] = useState<string[]>(
    activeView?.kpiOrder ?? initialKpis,
  );
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [viewLabel, setViewLabel] = useState(activeView?.label ?? "");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [makeDefault, setMakeDefault] = useState(
    activeView?.isDefault ?? false,
  );
  const [showHelp, setShowHelp] = useState(false);


  const authorized = useMemo(
    () => new Set(modules.map((m) => m.href)),
    [modules],
  );
  const pins = useMemo(
    () => favorites.filter((f) => authorized.has(f)).slice(0, 8),
    [favorites, authorized],
  );
  const filtered = useMemo(() => {
    const query = term.trim().toLocaleLowerCase();
    return modules
      .filter(
        (m) =>
          (category === "All tools" || m.category === category) &&
          (perspective === "all" || modulePerspective(m) === perspective) &&
          (!onlyFavorites || pins.includes(m.href)) &&
          (!query ||
            `${m.title} ${m.subtitle} ${m.category}`
              .toLocaleLowerCase()
              .includes(query)),
      )
      .sort((a, b) => {
        const pA = pins.includes(a.href) ? 0 : 1;
        const pB = pins.includes(b.href) ? 0 : 1;
        return pA - pB || a.title.localeCompare(b.title);
      });
  }, [modules, category, perspective, onlyFavorites, pins, term]);
  function toggleFavorite(href: string) {
    if (pins.includes(href)) {
      setFavorites((current) => current.filter((x) => x !== href));
      return;
    }
    if (pins.length >= 8) return;
    setFavorites((current) =>
      [...current.filter((x) => authorized.has(x)), href].slice(0, 8),
    );
  }
  function moveKpi(id: string, direction: number) {
    setKpiOrder((current) => {
      const next = [...current];
      const at = next.indexOf(id),
        target = at + direction;
      if (at < 0 || target < 0 || target >= next.length) return current;
      [next[at], next[target]] = [next[target], next[at]];
      return next;
    });
  }
  const activeName = activeView?.label ?? "Unsaved defaults";
  const hrefFor = (view?: CommandView) => {
    const p = new URLSearchParams({ campground: campgroundId });
    p.set("view", view?.id ?? "reset");
    return "/workspaces/management/command?" + p.toString();
  };
  return (
    <section
      className={
        "content-panel ops-detail-card camp-command__finder command194 " +
        (density === "compact" ? "command194--compact" : "")
      }
      aria-labelledby="command194-title"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Build 194 · Role-aware saved workspaces</p>
          <h2 id="command194-title">My Operations Command</h2>
        </div>
        <span className="ops-pill">
          {filtered.length} of {modules.length} authorized tools
        </span>
      </div>
      <p className="ops-inline-note">
        Each view is private to this staff account and campground. Metrics and
        access rights are always recalculated from current authorized sources; a
        saved favorite cannot grant access to another role.
      </p>
      <div className="command194__saved" aria-label="Saved layouts">
        <strong>Saved views · {savedViews.length}/8</strong>
        <div className="command194__chips">
          <Link
            className={
              !activeView
                ? "command194__chip command194__chip--active"
                : "command194__chip"
            }
            href={hrefFor()}
          >
            Standard reset
          </Link>
          {savedViews.map((view) => (
            <Link
              key={view.id}
              className={
                "command194__chip " +
                (activeView?.id === view.id ? "command194__chip--active" : "")
              }
              href={hrefFor(view)}
              aria-current={activeView?.id === view.id ? "page" : undefined}
            >
              {view.isDefault ? "★ " : ""}
              {view.label}
            </Link>
          ))}
        </div>
        <p className="ops-inline-note" role="status">
          Current: {activeName}.{" "}
          {preferencesAvailable
            ? "Stored across signed-in devices."
            : "Stored views currently unavailable; using safe local display controls."}
        </p>
      </div>
      <div
        className="command194__perspectives"
        role="group"
        aria-label="Workspace perspective"
      >
        {perspectives.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setPerspective(p.id)}
            aria-pressed={perspective === p.id}
            className={
              "secondary-button " +
              (perspective === p.id ? "command194__selected" : "")
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="camp-command__filters">
        <label>
          Search accessible workspaces
          <input
            type="search"
            placeholder="Reservations, maintenance, evidence…"
            value={term}
            maxLength={64}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <label>
          Module category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CommandCategory)}
          >
            {categories.map((c) => (
              <option value={c} key={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Layout density
          <select
            value={density}
            onChange={(e) => setDensity(e.target.value as CommandDensity)}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label className="command194__checkbox">
          <input
            type="checkbox"
            checked={onlyFavorites}
            onChange={(e) => setOnlyFavorites(e.target.checked)}
          />{" "}
          Favorites only
        </label>
      </div>
      <div className="command194__helper">
        <button
          type="button"
          className="secondary-button"
          aria-expanded={showHelp}
          onClick={() => setShowHelp(!showHelp)}
        >
          ⓘ Layout and source help
        </button>
        {showHelp ? (
          <p className="ops-inline-note">
            Filters and card order affect this dashboard only. Favorites are
            links, not elevated permissions. Restricted modules are never sent
            to this screen. A missing source shows “unavailable” rather than
            zero. Save a named view to recover these choices on another device.
          </p>
        ) : null}
      </div>
      <div className="camp-command__modules command194__modules">
        {filtered.map((item) => (
          <article key={item.href} className="command194__module">
            <Link
              href={
                item.href +
                (item.href.includes("?") ? "&" : "?") +
                "campground=" +
                encodeURIComponent(campgroundId)
              }
              className="camp-command__module"
            >
              <span className="camp-command__module-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>
                <small>
                  {modulePerspective(item).toUpperCase()} · {item.category}
                </small>
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </span>
              <b aria-hidden="true">↗</b>
            </Link>
            <button
              type="button"
              className="command194__pin secondary-button"
              aria-pressed={pins.includes(item.href)}
              onClick={() => toggleFavorite(item.href)}
              disabled={!pins.includes(item.href) && pins.length >= 8}
              aria-label={
                (pins.includes(item.href)
                  ? "Remove favorite: "
                  : "Favorite: ") + item.title
              }
            >
              {pins.includes(item.href) ? "★ Saved" : "☆ Pin"}
            </button>
          </article>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="ops-inline-note" role="status">
          No authorized workspaces match. Change a filter or turn off Favorites
          only. Hidden modules are not permission grants.
        </p>
      ) : null}
      <section
        className="command194__arrange"
        aria-labelledby="command194-metrics"
      >
        <h3 id="command194-metrics">Metric order and source inspector</h3>
        <p className="ops-inline-note">
          Move a metric earlier or later; its value stays on the server’s
          canonical source. Changes appear in the metric cards after saving and
          reopening the view.
        </p>
        <ol>
          {kpiOrder.map((key, i) => (
            <li key={key}>
              <span>{names[key] ?? key}</span>
              <button
                type="button"
                className="secondary-button"
                disabled={i === 0}
                onClick={() => moveKpi(key, -1)}
                aria-label={"Move " + names[key] + " earlier"}
              >
                ↑
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={i === kpiOrder.length - 1}
                onClick={() => moveKpi(key, 1)}
                aria-label={"Move " + names[key] + " later"}
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section className="command194__save" aria-labelledby="command194-save">
        <h3 id="command194-save">Save or update a layout</h3>
        <form action={saveCommandViewAction}>
          <input type="hidden" name="campgroundId" value={campgroundId} />
          <input
            type="hidden"
            name="viewId"
            value={updateExisting ? (activeView?.id ?? "") : ""}
          />
          <input
            type="hidden"
            name="expectedVersion"
            value={updateExisting ? (activeView?.rowVersion ?? 0) : 0}
          />
          <input type="hidden" name="perspective" value={perspective} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="searchTerm" value={term} />
          <input type="hidden" name="density" value={density} />
          {pins.map((href) => (
            <input type="hidden" key={href} name="favoriteHrefs" value={href} />
          ))}
          {kpiOrder.map((key) => (
            <input type="hidden" key={key} name="kpiOrder" value={key} />
          ))}
          <label>
            Layout name
            <input
              type="text"
              name="label"
              minLength={3}
              maxLength={48}
              required
              value={viewLabel}
              onChange={(e) => setViewLabel(e.target.value)}
              placeholder="e.g. Morning shift overview"
            />
          </label>
          {activeView ? (
            <label className="command194__checkbox">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
              />{" "}
              Update selected view (version {activeView.rowVersion}) instead of
              creating new
            </label>
          ) : null}
          <label className="command194__checkbox">
            <input
              type="checkbox"
              name="isDefault"
              value="yes"
              checked={makeDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
            />{" "}
            Make default for this campground
          </label>
          <div className="command194__actions">
            <button
              type="submit"
              className="primary-button"
              disabled={
                !preferencesAvailable ||
                (!updateExisting && savedViews.length >= 8)
              }
            >
              {updateExisting ? "Update selected view" : "Save new view"}
            </button>
          </div>
        </form>
        {activeView ? (
          <form action={deleteCommandViewAction} className="command194__delete">
            <input type="hidden" name="campgroundId" value={campgroundId} />
            <input type="hidden" name="viewId" value={activeView.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={activeView.rowVersion}
            />
            <button
              type="submit"
              className="secondary-button"
              disabled={!preferencesAvailable}
            >
              Delete selected saved view
            </button>
          </form>
        ) : null}
        <p className="ops-inline-note">
          Source readback: {sourceAsOf ?? "unavailable"}. No financial or
          reservation records are stored in views.
        </p>
      </section>
    </section>
  );
}
