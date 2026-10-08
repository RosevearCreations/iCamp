const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function freezeArray(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

export const demoCampgroundCatalogue = Object.freeze({
  fixtureVersion: 1,
  synthetic: true,
  organization: Object.freeze({
    id: "10000000-0000-4000-8000-000000000016",
    name: "iCamp Demo Operations",
    slug: "icamp-demo-operations",
  }),
  campground: Object.freeze({
    id: "20000000-0000-4000-8000-000000000016",
    name: "Pine Shore Demo Campground",
    slug: "pine-shore-demo-campground",
    timezone: "America/Toronto",
  }),
  sections: freezeArray([
    {
      id: "30000000-0000-4000-8000-000000000001",
      code: "PINE",
      name: "Pine Loop",
      sortOrder: 10,
      subsections: freezeArray([
        {
          id: "40000000-0000-4000-8000-000000000001",
          code: "PINE-A",
          name: "Pine A",
          sortOrder: 10,
        },
        {
          id: "40000000-0000-4000-8000-000000000002",
          code: "PINE-B",
          name: "Pine B",
          sortOrder: 20,
        },
      ]),
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      code: "WATER",
      name: "Waterfront",
      sortOrder: 20,
      subsections: freezeArray([
        {
          id: "40000000-0000-4000-8000-000000000003",
          code: "WATER-E",
          name: "East Shore",
          sortOrder: 10,
        },
        {
          id: "40000000-0000-4000-8000-000000000004",
          code: "WATER-W",
          name: "West Shore",
          sortOrder: 20,
        },
      ]),
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      code: "COTTAGE",
      name: "Cottage Grove",
      sortOrder: 30,
      subsections: freezeArray([
        {
          id: "40000000-0000-4000-8000-000000000005",
          code: "COTTAGE-N",
          name: "North Cottages",
          sortOrder: 10,
        },
      ]),
    },
    {
      id: "30000000-0000-4000-8000-000000000004",
      code: "REC",
      name: "Recreation",
      sortOrder: 40,
      subsections: freezeArray([
        {
          id: "40000000-0000-4000-8000-000000000006",
          code: "REC-CENTRAL",
          name: "Central Recreation",
          sortOrder: 10,
        },
      ]),
    },
    {
      id: "30000000-0000-4000-8000-000000000005",
      code: "OPS",
      name: "Operations",
      sortOrder: 50,
      subsections: freezeArray([
        {
          id: "40000000-0000-4000-8000-000000000007",
          code: "OPS-SERVICE",
          name: "Service Yard",
          sortOrder: 10,
        },
      ]),
    },
  ]),
  sites: freezeArray([
    {
      id: "demo-site-p01",
      code: "P-01",
      name: "Pine Site 01",
      sectionCode: "PINE",
      prototypeKind: "rv",
      prototypeOnly: true,
    },
    {
      id: "demo-site-p02",
      code: "P-02",
      name: "Pine Site 02",
      sectionCode: "PINE",
      prototypeKind: "mixed",
      prototypeOnly: true,
    },
    {
      id: "demo-site-p03",
      code: "P-03",
      name: "Pine Site 03",
      sectionCode: "PINE",
      prototypeKind: "tent",
      prototypeOnly: true,
    },
    {
      id: "demo-site-w01",
      code: "W-01",
      name: "Waterfront Site 01",
      sectionCode: "WATER",
      prototypeKind: "rv",
      prototypeOnly: true,
    },
    {
      id: "demo-site-w02",
      code: "W-02",
      name: "Waterfront Site 02",
      sectionCode: "WATER",
      prototypeKind: "mixed",
      prototypeOnly: true,
    },
    {
      id: "demo-site-w03",
      code: "W-03",
      name: "Waterfront Site 03",
      sectionCode: "WATER",
      prototypeKind: "tent",
      prototypeOnly: true,
    },
  ]),
  cottages: freezeArray([
    {
      id: "demo-cottage-c01",
      code: "C-01",
      name: "Demo Cedar Cottage",
      sectionCode: "COTTAGE",
      prototypeKind: "rustic",
      prototypeOnly: true,
    },
    {
      id: "demo-cottage-c02",
      code: "C-02",
      name: "Demo Maple Cottage",
      sectionCode: "COTTAGE",
      prototypeKind: "serviced",
      prototypeOnly: true,
    },
    {
      id: "demo-cottage-c03",
      code: "C-03",
      name: "Demo Birch Cottage",
      sectionCode: "COTTAGE",
      prototypeKind: "accessible",
      prototypeOnly: true,
    },
  ]),
  assets: freezeArray([
    {
      id: "demo-asset-gate",
      code: "GATE-01",
      name: "Demo Main Gate",
      sectionCode: "OPS",
      prototypeKind: "gate",
      prototypeOnly: true,
    },
    {
      id: "demo-asset-pool",
      code: "POOL-01",
      name: "Demo Pool",
      sectionCode: "REC",
      prototypeKind: "pool",
      prototypeOnly: true,
    },
    {
      id: "demo-asset-playground",
      code: "PLAY-01",
      name: "Demo Playground",
      sectionCode: "REC",
      prototypeKind: "playground",
      prototypeOnly: true,
    },
    {
      id: "demo-asset-washroom",
      code: "WASH-01",
      name: "Demo Washroom",
      sectionCode: "REC",
      prototypeKind: "washroom",
      prototypeOnly: true,
    },
    {
      id: "demo-asset-launch",
      code: "LAUNCH-01",
      name: "Demo Boat Launch",
      sectionCode: "WATER",
      prototypeKind: "boat-launch",
      prototypeOnly: true,
    },
    {
      id: "demo-asset-barn",
      code: "BARN-01",
      name: "Demo Maintenance Barn",
      sectionCode: "OPS",
      prototypeKind: "maintenance",
      prototypeOnly: true,
    },
  ]),
});

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${label} found in demo catalogue.`);
  }
}

export function validateDemoCampgroundCatalogue(
  catalogue = demoCampgroundCatalogue,
) {
  if (catalogue.synthetic !== true) {
    throw new Error("Demo catalogue must be explicitly marked synthetic.");
  }

  if (
    !UUID_PATTERN.test(catalogue.organization.id) ||
    !UUID_PATTERN.test(catalogue.campground.id)
  ) {
    throw new Error(
      "Demo organization and campground IDs must be UUIDv4 values.",
    );
  }

  const sectionCodes = catalogue.sections.map((section) => section.code);
  const sectionIds = catalogue.sections.map((section) => section.id);
  const subsectionIds = catalogue.sections.flatMap((section) =>
    section.subsections.map((subsection) => subsection.id),
  );
  const prototypes = [
    ...catalogue.sites,
    ...catalogue.cottages,
    ...catalogue.assets,
  ];

  assertUnique(sectionCodes, "section code");
  assertUnique(sectionIds, "section ID");
  assertUnique(subsectionIds, "subsection ID");
  assertUnique(
    prototypes.map((item) => item.id),
    "prototype fixture ID",
  );
  assertUnique(
    prototypes.map((item) => item.code),
    "prototype fixture code",
  );

  for (const section of catalogue.sections) {
    if (!UUID_PATTERN.test(section.id)) {
      throw new Error(`Section ${section.code} must use a UUIDv4 ID.`);
    }

    for (const subsection of section.subsections) {
      if (!UUID_PATTERN.test(subsection.id)) {
        throw new Error(`Subsection ${subsection.code} must use a UUIDv4 ID.`);
      }
    }
  }

  for (const item of prototypes) {
    if (item.prototypeOnly !== true) {
      throw new Error(`${item.code} must remain prototype-only in Build 016.`);
    }

    if (!sectionCodes.includes(item.sectionCode)) {
      throw new Error(
        `${item.code} references unknown section ${item.sectionCode}.`,
      );
    }
  }

  const serialized = JSON.stringify(catalogue);

  if (
    serialized.includes("@") ||
    /\b\+?1?[- .]?\(?\d{3}\)?[- .]\d{3}[- .]\d{4}\b/u.test(serialized)
  ) {
    throw new Error(
      "Demo catalogue must not contain email addresses or telephone numbers.",
    );
  }

  return Object.freeze({
    fixtureVersion: catalogue.fixtureVersion,
    sections: catalogue.sections.length,
    subsections: subsectionIds.length,
    sites: catalogue.sites.length,
    cottages: catalogue.cottages.length,
    assets: catalogue.assets.length,
  });
}

export function assertDemoSeedAllowed(env = process.env) {
  const environment = (
    env.ICAMP_APP_ENV ??
    env.NEXT_PUBLIC_APP_ENV ??
    env.NODE_ENV ??
    "development"
  )
    .trim()
    .toLowerCase();

  if (environment === "production") {
    throw new Error("Demo campground seeding is forbidden in production.");
  }

  if (env.ICAMP_ALLOW_DEMO_SEED !== "true") {
    throw new Error(
      "ICAMP_ALLOW_DEMO_SEED=true is required to seed synthetic demo data.",
    );
  }

  return environment;
}

export const demoCampgroundSummary = validateDemoCampgroundCatalogue();
