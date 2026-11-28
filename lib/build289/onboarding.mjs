/** Readiness observations are not publication, subscription or owner approval. */
export function onboardingReadiness289({
  structure,
  accommodations,
  maps,
}) {
  const sections = structure?.sections;
  const activeSites = accommodations?.filter(
    (site) => site.lifecycleState === "active",
  );
  return [
    {
      key: "property",
      title: "Property details",
      state: structure ? "RECORDED" : "UNKNOWN",
    },
    {
      key: "sections",
      title: "Active campground sections",
      state: sections
        ? sections.some((section) => section.lifecycleState === "active")
          ? "RECORDED"
          : "NEEDS_SETUP"
        : "UNKNOWN",
    },
    {
      key: "accommodations",
      title: "Active campsites and accommodations",
      state: activeSites
        ? activeSites.length
          ? "RECORDED"
          : "NEEDS_SETUP"
        : "UNKNOWN",
    },
    {
      key: "maps",
      title: "Published map with reviewed bindings",
      state: maps
        ? maps.some((map) => map.isPublished && map.readiness?.ready)
          ? "RECORDED"
          : "NEEDS_SETUP"
        : "UNKNOWN",
    },
  ];
}

export function prepareTenantPlan289(input) {
  const name = String(input.name ?? "").trim();
  const region = String(input.region ?? "").trim();
  const timezone = String(input.timezone ?? "").trim();
  const season = String(input.season ?? "");
  const siteCount = Number(input.siteCount);
  if (!name || name.length > 160 || !region || region.length > 160)
    throw new Error("Enter a campground name and region (up to 160 characters).");
  if (!timezone || timezone.length > 100)
    throw new Error("Enter a valid IANA timezone.");
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  } catch {
    throw new Error("Enter a valid IANA timezone.");
  }
  if (!["seasonal", "year_round"].includes(season))
    throw new Error("Select an operating season.");
  if (!Number.isSafeInteger(siteCount) || siteCount < 1 || siteCount > 100000)
    throw new Error("Enter a site count from 1 to 100,000.");
  return {
    schema: "icamp.tenant-onboarding-plan.v1",
    name,
    region,
    timezone,
    season,
    siteCount,
    state: "DRAFT_NOT_PROVISIONED",
    tenantCreated: false,
    billingEnabled: false,
    ownerAssignmentCreated: false,
    reviewRequired: [
      "independent operator and tenant custody",
      "unique organization and campground identity",
      "authorized owner assignment",
      "approved terms and billing configuration",
      "isolated tenant acceptance",
    ],
  };
}
