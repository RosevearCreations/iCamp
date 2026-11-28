"use client";

import { useState } from "react";

import { prepareTenantPlan289 } from "@/lib/build289/onboarding.mjs";

export function TenantPlan() {
  const [plan, setPlan] = useState<ReturnType<
    typeof prepareTenantPlan289
  > | null>(null);
  const [error, setError] = useState("");
  function review(form: FormData) {
    setPlan(null);
    setError("");
    try {
      setPlan(
        prepareTenantPlan289({
          name: form.get("name"),
          region: form.get("region"),
          timezone: form.get("timezone"),
          season: form.get("season"),
          siteCount: form.get("siteCount"),
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invalid plan.");
    }
  }

  function download() {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "icamp-onboarding-draft.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <form className="auth-form" action={review}>
        <label>
          Campground name
          <input name="name" maxLength={160} required />
        </label>
        <label>
          Region (city, province or territory)
          <input name="region" maxLength={160} required />
        </label>
        <label>
          Timezone
          <input name="timezone" defaultValue="America/Toronto" required />
        </label>
        <label>
          Operating season
          <select name="season" defaultValue="seasonal">
            <option value="seasonal">Seasonal</option>
            <option value="year_round">Year-round</option>
          </select>
        </label>
        <label>
          Planned accommodation count
          <input name="siteCount" type="number" min={1} max={100000} required />
        </label>
        <button type="submit" className="primary-button">
          Review onboarding draft
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {plan ? (
        <section className="content-panel" aria-live="polite">
          <h2>Review — not provisioned</h2>
          <p>{plan.name} · {plan.region} · {plan.timezone}</p>
          <p>{plan.siteCount} planned accommodations · {plan.season}</p>
          <ul>
            {plan.reviewRequired.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            No tenant, account, payment or subscription was created. Export the
            draft for authorized provisioning review.
          </p>
          <button type="button" onClick={download}>
            Download reviewed draft
          </button>
        </section>
      ) : null}
    </>
  );
}
