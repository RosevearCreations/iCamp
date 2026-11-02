"use client";

import { useState } from "react";

export function EnforcementScopeFields({
  facilities,
  zones,
}: Readonly<{
  facilities: { id: string; code: string; display_name: string }[];
  zones: { id: string; zone_code: string; display_name: string }[];
}>) {
  const [scopeType, setScopeType] = useState("campground");
  return (
    <>
      <label>
        Affected area or feature
        <select
          name="scopeType"
          value={scopeType}
          onChange={(event) => setScopeType(event.target.value)}
          required
        >
          <option value="campground">Campground-wide</option>
          <option value="feature">Feature category</option>
          <option value="facility">Named facility</option>
          <option value="access_zone">Named access zone</option>
        </select>
      </label>
      {scopeType === "feature" ? (
        <label>
          Feature category
          <select name="feature" required defaultValue="pool">
            {[
              "pool",
              "waterfront",
              "sports",
              "playground",
              "event",
              "access",
            ].map((feature) => (
              <option key={feature} value={feature}>
                {feature}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {scopeType === "facility" ? (
        <label>
          Facility
          <select name="facilityId" required defaultValue="">
            <option value="" disabled>
              Choose a facility
            </option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.code} · {facility.display_name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {scopeType === "access_zone" ? (
        <label>
          Access zone
          <select name="accessZoneId" required defaultValue="">
            <option value="" disabled>
              Choose a zone
            </option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.zone_code} · {zone.display_name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}
