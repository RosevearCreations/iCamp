import { randomUUID } from "node:crypto";
import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";

const { Pool } = pg;
let pool;
const VIEWS_LIMIT = 8;
const PERSPECTIVES = ["all", "management", "it", "status", "statistics"];
const CATEGORIES = [
  "All tools",
  "Bookings",
  "Guest services",
  "Property",
  "Analytics",
  "Administration",
];
const KPI_IDS = ["sites", "arrivals", "work_orders", "financial"];
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required for command preferences.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
export async function closeCommandViewsPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
function uuid(value, label = "Identifier") {
  const text = String(value ?? "");
  if (
    !/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
      text,
    )
  )
    throw new Error(label + " must be a UUID.");
  return text;
}
async function scope(userId, campgroundId) {
  uuid(userId, "Staff user");
  uuid(campgroundId, "Campground");
  const authorization = await getCampgroundAuthorization(userId, campgroundId);
  if (!authorization?.permissions.includes("reports.read"))
    throw new Error("Not authorized to view campground Command layouts.");
  return authorization;
}
async function withActor(userId, fn) {
  const client = await database().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
function mapView(row) {
  return {
    id: row.id,
    label: row.label,
    perspective: row.perspective,
    category: row.category,
    searchTerm: row.search_term,
    density: row.density,
    favoriteHrefs: row.favorite_hrefs,
    kpiOrder: row.kpi_order,
    isDefault: row.is_default,
    rowVersion: Number(row.row_version),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
export async function getCommandViews({ userId, campgroundId }) {
  await scope(userId, campgroundId);
  return withActor(userId, async (client) => {
    const result = await client.query(
      "select id,label,perspective,category,search_term,density,favorite_hrefs,kpi_order,is_default,row_version,created_at,updated_at " +
        "from icamp_private.management_command_views where user_id=$1 and campground_id=$2 " +
        "order by is_default desc,updated_at desc,id limit 8",
      [userId, campgroundId],
    );
    return result.rows.map(mapView);
  });
}
export function normalizeCommandLayout(input, authorizedModules) {
  const label = String(input.label ?? "").trim();
  if (label.length < 3 || label.length > 48)
    throw new Error("View name must be 3–48 characters.");
  const perspective = String(input.perspective ?? "all");
  const category = String(input.category ?? "All tools");
  const density = String(input.density ?? "comfortable");
  if (
    !PERSPECTIVES.includes(perspective) ||
    !CATEGORIES.includes(category) ||
    !["comfortable", "compact"].includes(density)
  )
    throw new Error("Invalid Command filter or density.");
  const searchTerm = String(input.searchTerm ?? "").trim();
  if (searchTerm.length > 64)
    throw new Error("Search text must be no longer than 64 characters.");
  const favoriteHrefs = Array.isArray(input.favoriteHrefs)
    ? input.favoriteHrefs.map(String)
    : [];
  const allowed = new Set(authorizedModules.map((item) => item.href));
  if (
    favoriteHrefs.length > 8 ||
    new Set(favoriteHrefs).size !== favoriteHrefs.length ||
    favoriteHrefs.some((x) => !allowed.has(x))
  )
    throw new Error(
      "Favorites must be unique, accessible campground modules (maximum 8).",
    );
  const kpiOrder = Array.isArray(input.kpiOrder)
    ? input.kpiOrder.map(String)
    : KPI_IDS;
  if (
    kpiOrder.length !== 4 ||
    new Set(kpiOrder).size !== 4 ||
    kpiOrder.some((x) => !KPI_IDS.includes(x))
  )
    throw new Error("Invalid Command metric card order.");
  return {
    label,
    perspective,
    category,
    density,
    searchTerm,
    favoriteHrefs,
    kpiOrder,
    isDefault: input.isDefault === true,
  };
}
export async function saveCommandView({
  userId,
  campgroundId,
  input,
  authorizedModules,
}) {
  const auth = await scope(userId, campgroundId);
  const layout = normalizeCommandLayout(input, authorizedModules);
  const viewId = input.viewId ? uuid(input.viewId, "Saved view") : randomUUID();
  const expectedVersion = Number(input.expectedVersion ?? 0);
  if (
    input.viewId &&
    (!Number.isInteger(expectedVersion) || expectedVersion < 1)
  )
    throw new Error("View version is missing; refresh before saving.");
  return withActor(userId, async (client) => {
    if (layout.isDefault) {
      await client.query(
        "update icamp_private.management_command_views set is_default=false " +
          "where campground_id=$1 and user_id=$2 and is_default=true and id<>$3",
        [campgroundId, userId, viewId],
      );
    }
    const fields = [
      layout.label,
      layout.perspective,
      layout.category,
      layout.searchTerm,
      layout.density,
      layout.favoriteHrefs,
      layout.kpiOrder,
      layout.isDefault,
    ];
    let result;
    if (input.viewId) {
      result = await client.query(
        "update icamp_private.management_command_views set label=$4,perspective=$5,category=$6,search_term=$7,density=$8,favorite_hrefs=$9,kpi_order=$10,is_default=$11 " +
          "where user_id=$1 and campground_id=$2 and id=$3 and row_version=$12 returning id,row_version",
        [userId, campgroundId, viewId, ...fields, expectedVersion],
      );
      if (result.rowCount !== 1)
        throw new Error(
          "Saved view changed or is not accessible. Refresh and retry.",
        );
    } else {
      result = await client.query(
        "insert into icamp_private.management_command_views " +
          "(id,organization_id,campground_id,user_id,label,perspective,category,search_term,density,favorite_hrefs,kpi_order,is_default) " +
          "values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id,row_version",
        [viewId, auth.organizationId, campgroundId, userId, ...fields],
      );
    }
    return {
      id: result.rows[0].id,
      rowVersion: Number(result.rows[0].row_version),
    };
  });
}
export async function deleteCommandView({
  userId,
  campgroundId,
  viewId,
  expectedVersion,
}) {
  await scope(userId, campgroundId);
  uuid(viewId, "Saved view");
  const version = Number(expectedVersion);
  if (!Number.isInteger(version) || version < 1)
    throw new Error("Invalid saved view version.");
  return withActor(userId, async (client) => {
    const result = await client.query(
      "delete from icamp_private.management_command_views " +
        "where id=$1 and campground_id=$2 and user_id=$3 and row_version=$4 returning id",
      [viewId, campgroundId, userId, version],
    );
    if (result.rowCount !== 1)
      throw new Error(
        "Saved view changed or is unavailable; refresh and retry.",
      );
    return { id: viewId };
  });
}
export const commandViewLimits = {
  views: VIEWS_LIMIT,
  favorites: 8,
  kpis: KPI_IDS,
};
