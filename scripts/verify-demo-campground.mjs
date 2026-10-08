import pg from "pg";

import {
  demoCampgroundCatalogue,
  validateDemoCampgroundCatalogue,
} from "../lib/demo/catalogue.mjs";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to verify the demo campground.");
}

const summary = validateDemoCampgroundCatalogue();
const client = new Client({ connectionString: databaseUrl });

await client.connect();

try {
  const campground = await client.query(
    `
      select
        c.id,
        c.name,
        c.slug,
        c.timezone,
        o.id as organization_id,
        o.slug as organization_slug
      from public.campgrounds c
      join public.organizations o on o.id = c.organization_id
      where c.id = $1
    `,
    [demoCampgroundCatalogue.campground.id],
  );

  if (campground.rowCount !== 1) {
    throw new Error("Synthetic demo campground is missing from the database.");
  }

  const row = campground.rows[0];

  if (
    row.organization_id !== demoCampgroundCatalogue.organization.id ||
    row.organization_slug !== demoCampgroundCatalogue.organization.slug ||
    row.slug !== demoCampgroundCatalogue.campground.slug ||
    row.timezone !== demoCampgroundCatalogue.campground.timezone
  ) {
    throw new Error(
      "Synthetic demo campground identity does not match fixtures.",
    );
  }

  const sectionCount = await client.query(
    `
      select count(*)::integer as count
      from public.campground_sections
      where campground_id = $1
        and lifecycle_state = 'active'
    `,
    [demoCampgroundCatalogue.campground.id],
  );

  const subsectionCount = await client.query(
    `
      select count(*)::integer as count
      from public.campground_subsections
      where campground_id = $1
        and lifecycle_state = 'active'
    `,
    [demoCampgroundCatalogue.campground.id],
  );

  if (sectionCount.rows[0].count !== summary.sections) {
    throw new Error("Synthetic demo section count does not match fixtures.");
  }

  if (subsectionCount.rows[0].count !== summary.subsections) {
    throw new Error("Synthetic demo subsection count does not match fixtures.");
  }
} finally {
  await client.end();
}

process.stdout.write(
  `Verified synthetic demo campground: ${summary.sections} sections, ${summary.subsections} subsections, ${summary.sites} site prototypes, ${summary.cottages} cottage prototypes, and ${summary.assets} asset prototypes.\n`,
);
