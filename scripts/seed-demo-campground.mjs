import pg from "pg";

import {
  assertDemoSeedAllowed,
  demoCampgroundCatalogue,
  validateDemoCampgroundCatalogue,
} from "../lib/demo/catalogue.mjs";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the demo campground.");
}

const environment = assertDemoSeedAllowed(process.env);
validateDemoCampgroundCatalogue();

const client = new Client({ connectionString: databaseUrl });

async function seed() {
  await client.connect();

  try {
    await client.query("begin");

    await client.query(
      `
        insert into public.organizations (id, name, slug, lifecycle_state)
        values ($1, $2, $3, 'active')
        on conflict (id) do update
        set
          name = excluded.name,
          slug = excluded.slug,
          lifecycle_state = 'active',
          archived_at = null
      `,
      [
        demoCampgroundCatalogue.organization.id,
        demoCampgroundCatalogue.organization.name,
        demoCampgroundCatalogue.organization.slug,
      ],
    );

    await client.query(
      `
        insert into public.campgrounds (
          id,
          organization_id,
          name,
          slug,
          timezone,
          lifecycle_state
        )
        values ($1, $2, $3, $4, $5, 'active')
        on conflict (id) do update
        set
          organization_id = excluded.organization_id,
          name = excluded.name,
          slug = excluded.slug,
          timezone = excluded.timezone,
          lifecycle_state = 'active',
          archived_at = null
      `,
      [
        demoCampgroundCatalogue.campground.id,
        demoCampgroundCatalogue.organization.id,
        demoCampgroundCatalogue.campground.name,
        demoCampgroundCatalogue.campground.slug,
        demoCampgroundCatalogue.campground.timezone,
      ],
    );

    for (const section of demoCampgroundCatalogue.sections) {
      await client.query(
        `
          insert into public.campground_sections (
            id,
            organization_id,
            campground_id,
            name,
            code,
            sort_order,
            lifecycle_state
          )
          values ($1, $2, $3, $4, $5, $6, 'active')
          on conflict (id) do update
          set
            organization_id = excluded.organization_id,
            campground_id = excluded.campground_id,
            name = excluded.name,
            code = excluded.code,
            sort_order = excluded.sort_order,
            lifecycle_state = 'active',
            archived_at = null
        `,
        [
          section.id,
          demoCampgroundCatalogue.organization.id,
          demoCampgroundCatalogue.campground.id,
          section.name,
          section.code,
          section.sortOrder,
        ],
      );

      for (const subsection of section.subsections) {
        await client.query(
          `
            insert into public.campground_subsections (
              id,
              organization_id,
              campground_id,
              section_id,
              name,
              code,
              sort_order,
              lifecycle_state
            )
            values ($1, $2, $3, $4, $5, $6, $7, 'active')
            on conflict (id) do update
            set
              organization_id = excluded.organization_id,
              campground_id = excluded.campground_id,
              section_id = excluded.section_id,
              name = excluded.name,
              code = excluded.code,
              sort_order = excluded.sort_order,
              lifecycle_state = 'active',
              archived_at = null
          `,
          [
            subsection.id,
            demoCampgroundCatalogue.organization.id,
            demoCampgroundCatalogue.campground.id,
            section.id,
            subsection.name,
            subsection.code,
            subsection.sortOrder,
          ],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

await seed();

process.stdout.write(
  `Seeded ${demoCampgroundCatalogue.campground.name} for ${environment} using synthetic Build 016 data only.\n`,
);
