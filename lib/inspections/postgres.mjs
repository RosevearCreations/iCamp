import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  validateInspectionResultInput,
  validateInspectionSignoffInput,
  validateInspectionTemplateInput,
  validateInspectionVersionInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for inspection operations.");
  }
  return value;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeInspectionPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertPermission(userId, campgroundId, permission) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permission))) {
    throw new Error(`Not authorized for ${permission}.`);
  }
}

async function assertCanRead(userId, campgroundId) {
  const allowed = await Promise.all(
    [
      "inspection.perform",
      "inspection.signoff",
      "inspection.template.manage",
    ].map((permission) =>
      hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  if (!allowed.some(Boolean)) {
    throw new Error("Not authorized to read inspection operations.");
  }
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    `select organization_id,id,name,timezone
     from public.campgrounds
     where id=$1 and lifecycle_state <> 'archived'
     limit 1`,
    [campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Campground is unavailable.");
  }
  return result.rows[0];
}

async function beginRls(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
}

function mapItem(row) {
  return {
    id: row.id,
    itemKey: row.item_key,
    position: Number(row.position),
    label: row.label,
    required: row.required === true,
    failureCreatesWorkOrder: row.failure_creates_work_order === true,
  };
}

function mapVersion(row, itemsByVersion) {
  return {
    id: row.id,
    templateId: row.template_id,
    versionNumber: Number(row.version_number),
    instructions: row.instructions ?? null,
    signoffRequired: row.signoff_required === true,
    failureCategoryId: row.failure_category_id,
    failureCategoryName: row.failure_category_name ?? null,
    failurePriorityPolicyId: row.failure_priority_policy_id,
    failurePriorityKey: row.failure_priority_key ?? null,
    publishedAt: row.published_at ?? null,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    items: itemsByVersion.get(row.id) ?? [],
  };
}

function mapResult(row) {
  return {
    id: row.id,
    occurrenceId: row.occurrence_id,
    templateItemId: row.template_item_id,
    resultValue: row.result_value,
    note: row.note ?? null,
    recordedByUserId: row.recorded_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rowVersion: Number(row.row_version),
  };
}

export async function getInspectionWorkspace(userId, campgroundId) {
  await assertCanRead(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    const [assetResult, accommodationResult, categoryResult, priorityResult] =
      await Promise.all([
        client.query(
          `select id,display_name
           from public.operational_assets
           where campground_id=$1 and lifecycle_state <> 'archived'
           order by display_name`,
          [campgroundId],
        ),
        client.query(
          `select id,accommodation_kind,code,display_name
           from public.accommodations
           where campground_id=$1
             and lifecycle_state <> 'archived'
             and accommodation_kind in ('campsite','rental_cottage')
           order by accommodation_kind,code,display_name`,
          [campgroundId],
        ),
        client.query(
          `select id,display_name
           from public.maintenance_categories
           where campground_id=$1 and is_active
           order by is_standard desc,display_name`,
          [campgroundId],
        ),
        client.query(
          `select id,priority_key
           from public.maintenance_priority_policies
           where campground_id=$1
           order by priority_key`,
          [campgroundId],
        ),
      ]);

    await beginRls(client, userId);
    const [
      templateResult,
      versionResult,
      itemResult,
      occurrenceResult,
      resultResult,
      signoffResult,
      correctiveResult,
    ] = await Promise.all([
      client.query(
        `select
           t.*,
           a.display_name as asset_name,
           ac.code as accommodation_code,
           ac.display_name as accommodation_name
         from public.inspection_templates t
         left join public.operational_assets a on a.id=t.asset_id
         left join public.accommodations ac on ac.id=t.accommodation_id
         where t.campground_id=$1
         order by t.is_active desc,t.name`,
        [campgroundId],
      ),
      client.query(
        `select
           v.*,
           c.display_name as failure_category_name,
           p.priority_key as failure_priority_key
         from public.inspection_template_versions v
         join public.maintenance_categories c on c.id=v.failure_category_id
         join public.maintenance_priority_policies p
           on p.id=v.failure_priority_policy_id
         where v.campground_id=$1
         order by v.template_id,v.version_number desc`,
        [campgroundId],
      ),
      client.query(
        `select *
         from public.inspection_template_items
         where campground_id=$1
         order by template_version_id,position`,
        [campgroundId],
      ),
      client.query(
        `select
           o.*,
           t.name as template_name,
           v.version_number,
           a.display_name as asset_name,
           ac.code as accommodation_code,
           ac.display_name as accommodation_name
         from public.inspection_occurrences o
         join public.inspection_templates t on t.id=o.template_id
         join public.inspection_template_versions v on v.id=o.template_version_id
         left join public.operational_assets a on a.id=o.asset_id
         left join public.accommodations ac on ac.id=o.accommodation_id
         where o.campground_id=$1
         order by
           case o.status
             when 'in_progress' then 1
             when 'submitted' then 2
             else 3
           end,
           o.started_at desc
         limit 100`,
        [campgroundId],
      ),
      client.query(
        `select *
         from public.inspection_results
         where campground_id=$1
         order by occurrence_id,created_at`,
        [campgroundId],
      ),
      client.query(
        `select *
         from public.inspection_signoffs
         where campground_id=$1
         order by signed_at desc`,
        [campgroundId],
      ),
      client.query(
        `select *
         from public.inspection_corrective_actions
         where campground_id=$1
         order by created_at desc`,
        [campgroundId],
      ),
    ]);
    await client.query("commit");

    const itemsByVersion = new Map();
    for (const row of itemResult.rows) {
      const list = itemsByVersion.get(row.template_version_id) ?? [];
      list.push(mapItem(row));
      itemsByVersion.set(row.template_version_id, list);
    }

    const versions = versionResult.rows.map((row) =>
      mapVersion(row, itemsByVersion),
    );
    const versionsByTemplate = new Map();
    for (const version of versions) {
      const list = versionsByTemplate.get(version.templateId) ?? [];
      list.push(version);
      versionsByTemplate.set(version.templateId, list);
    }

    const resultsByOccurrence = new Map();
    for (const row of resultResult.rows) {
      const list = resultsByOccurrence.get(row.occurrence_id) ?? [];
      list.push(mapResult(row));
      resultsByOccurrence.set(row.occurrence_id, list);
    }

    const signoffByOccurrence = new Map(
      signoffResult.rows.map((row) => [
        row.occurrence_id,
        {
          id: row.id,
          decision: row.decision,
          note: row.note ?? null,
          signedByUserId: row.signed_by_user_id,
          signedAt: row.signed_at,
        },
      ]),
    );

    const correctiveByResult = new Map(
      correctiveResult.rows.map((row) => [
        row.inspection_result_id,
        {
          id: row.id,
          workOrderId: row.work_order_id,
          createdAt: row.created_at,
        },
      ]),
    );

    const templates = templateResult.rows.map((row) => {
      const templateVersions = versionsByTemplate.get(row.id) ?? [];
      return {
        id: row.id,
        targetKind: row.target_kind,
        assetId: row.asset_id ?? null,
        accommodationId: row.accommodation_id ?? null,
        targetLabel:
          row.asset_name ??
          [row.accommodation_code, row.accommodation_name]
            .filter(Boolean)
            .join(" · "),
        name: row.name,
        description: row.description ?? null,
        isActive: row.is_active === true,
        currentVersionId: row.current_version_id ?? null,
        rowVersion: Number(row.row_version),
        versions: templateVersions,
        currentVersion:
          templateVersions.find(
            (version) => version.id === row.current_version_id,
          ) ?? null,
      };
    });

    const versionById = new Map(versions.map((version) => [version.id, version]));
    const occurrences = occurrenceResult.rows.map((row) => {
      const occurrenceResults = resultsByOccurrence.get(row.id) ?? [];
      return {
        id: row.id,
        templateId: row.template_id,
        templateName: row.template_name,
        templateVersionId: row.template_version_id,
        versionNumber: Number(row.version_number),
        targetKind: row.target_kind,
        targetLabel:
          row.asset_name ??
          [row.accommodation_code, row.accommodation_name]
            .filter(Boolean)
            .join(" · "),
        inspectorUserId: row.inspector_user_id,
        status: row.status,
        signoffRequired: row.signoff_required === true,
        startedAt: row.started_at,
        submittedAt: row.submitted_at ?? null,
        finalizedAt: row.finalized_at ?? null,
        rowVersion: Number(row.row_version),
        version: versionById.get(row.template_version_id) ?? null,
        results: occurrenceResults.map((result) => ({
          ...result,
          correctiveAction: correctiveByResult.get(result.id) ?? null,
        })),
        signoff: signoffByOccurrence.get(row.id) ?? null,
      };
    });

    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        name: campground.name,
        timezone: campground.timezone,
      },
      generatedAt: new Date().toISOString(),
      assets: assetResult.rows.map((row) => ({
        id: row.id,
        name: row.display_name,
      })),
      sites: accommodationResult.rows
        .filter((row) => row.accommodation_kind === "campsite")
        .map((row) => ({
          id: row.id,
          code: row.code,
          name: row.display_name,
        })),
      cottages: accommodationResult.rows
        .filter((row) => row.accommodation_kind === "rental_cottage")
        .map((row) => ({
          id: row.id,
          code: row.code,
          name: row.display_name,
        })),
      categories: categoryResult.rows.map((row) => ({
        id: row.id,
        name: row.display_name,
      })),
      priorities: priorityResult.rows.map((row) => ({
        id: row.id,
        priorityKey: row.priority_key,
      })),
      templates,
      occurrences,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function insertVersion({
  client,
  actorUserId,
  campground,
  templateId,
  versionNumber,
  input,
}) {
  const version = validateInspectionVersionInput(input);
  const [categoryResult, priorityResult] = await Promise.all([
    client.query(
      `select id
       from public.maintenance_categories
       where id=$1 and campground_id=$2 and is_active
       limit 1`,
      [version.failureCategoryId, campground.id],
    ),
    client.query(
      `select id
       from public.maintenance_priority_policies
       where id=$1 and campground_id=$2
       limit 1`,
      [version.failurePriorityPolicyId, campground.id],
    ),
  ]);
  if (categoryResult.rowCount !== 1) {
    throw new Error("Corrective-work category is unavailable.");
  }
  if (priorityResult.rowCount !== 1) {
    throw new Error("Corrective-work priority is unavailable.");
  }

  const versionResult = await client.query(
    `insert into public.inspection_template_versions (
       organization_id,campground_id,template_id,version_number,instructions,
       signoff_required,failure_category_id,failure_priority_policy_id,
       created_by_user_id
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning id`,
    [
      campground.organization_id,
      campground.id,
      templateId,
      versionNumber,
      version.versionInstructions,
      version.signoffRequired,
      version.failureCategoryId,
      version.failurePriorityPolicyId,
      actorUserId,
    ],
  );
  const versionId = versionResult.rows[0].id;

  for (const item of version.items) {
    await client.query(
      `insert into public.inspection_template_items (
         organization_id,campground_id,template_version_id,item_key,position,
         label,required,failure_creates_work_order,created_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        campground.organization_id,
        campground.id,
        versionId,
        item.itemKey,
        item.position,
        item.label,
        item.required,
        item.failureCreatesWorkOrder,
        actorUserId,
      ],
    );
  }

  await client.query(
    `update public.inspection_template_versions
     set published_at=statement_timestamp()
     where id=$1`,
    [versionId],
  );

  await client.query(
    `update public.inspection_templates
     set current_version_id=$3,updated_by_user_id=$4
     where id=$1 and campground_id=$2`,
    [templateId, campground.id, versionId, actorUserId],
  );

  return { versionId, version };
}

export async function createInspectionTemplate({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "inspection.template.manage",
  );
  const template = validateInspectionTemplateInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);

    const inserted = await client.query(
      `insert into public.inspection_templates (
         organization_id,campground_id,target_kind,asset_id,accommodation_id,
         name,description,created_by_user_id,updated_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$8)
       returning id`,
      [
        campground.organization_id,
        campgroundId,
        template.targetKind,
        template.assetId,
        template.accommodationId,
        template.name,
        template.description,
        actorUserId,
      ],
    );
    const templateId = inserted.rows[0].id;

    const { versionId } = await insertVersion({
      client,
      actorUserId,
      campground,
      templateId,
      versionNumber: 1,
      input: {
        versionInstructions: template.versionInstructions,
        signoffRequired: template.signoffRequired,
        failureCategoryId: template.failureCategoryId,
        failurePriorityPolicyId: template.failurePriorityPolicyId,
        itemsText: template.items.map((item) => item.label).join("\n"),
      },
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "inspection.template.create",
      permissionKey: "inspection.template.manage",
      riskLevel: "elevated",
      subjectType: "inspection.template",
      subjectId: templateId,
      afterState: {
        targetKind: template.targetKind,
        currentVersionId: versionId,
        versionNumber: 1,
      },
    });

    await client.query("commit");
    return templateId;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function publishInspectionTemplateVersion({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  templateId,
  ...input
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "inspection.template.manage",
  );
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);

    const templateResult = await client.query(
      `select id,current_version_id
       from public.inspection_templates
       where id=$1 and campground_id=$2
       limit 1
       for update`,
      [templateId, campgroundId],
    );
    if (templateResult.rowCount !== 1) {
      throw new Error("Inspection template is unavailable.");
    }

    const numberResult = await client.query(
      `select coalesce(max(version_number),0)+1 as next_version
       from public.inspection_template_versions
       where template_id=$1`,
      [templateId],
    );
    const versionNumber = Number(numberResult.rows[0].next_version);
    const { versionId } = await insertVersion({
      client,
      actorUserId,
      campground,
      templateId,
      versionNumber,
      input,
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "inspection.template.version.publish",
      permissionKey: "inspection.template.manage",
      riskLevel: "elevated",
      subjectType: "inspection.template",
      subjectId: templateId,
      metadata: { versionId, versionNumber },
    });

    await client.query("commit");
    return versionId;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setInspectionTemplateActive({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  templateId,
  isActive,
  expectedRowVersion,
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "inspection.template.manage",
  );
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Inspection template row version is invalid.");
  }
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);
    const updated = await client.query(
      `update public.inspection_templates
       set is_active=$4,updated_by_user_id=$5
       where id=$1 and campground_id=$2 and row_version=$3
       returning row_version`,
      [templateId, campgroundId, expected, Boolean(isActive), actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Inspection template changed since this page loaded. Refresh and try again.",
      );
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: isActive
        ? "inspection.template.activate"
        : "inspection.template.deactivate",
      permissionKey: "inspection.template.manage",
      riskLevel: "elevated",
      subjectType: "inspection.template",
      subjectId: templateId,
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function startInspection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  templateId,
}) {
  await assertPermission(actorUserId, campgroundId, "inspection.perform");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);
    const templateResult = await client.query(
      `select
         t.*,
         v.signoff_required
       from public.inspection_templates t
       join public.inspection_template_versions v
         on v.id=t.current_version_id
       where t.id=$1
         and t.campground_id=$2
         and t.is_active
         and v.published_at is not null
       limit 1`,
      [templateId, campgroundId],
    );
    if (templateResult.rowCount !== 1) {
      throw new Error("Active published inspection template is unavailable.");
    }
    const template = templateResult.rows[0];

    const inserted = await client.query(
      `insert into public.inspection_occurrences (
         organization_id,campground_id,template_id,template_version_id,
         target_kind,asset_id,accommodation_id,inspector_user_id,
         signoff_required
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning id`,
      [
        campground.organization_id,
        campgroundId,
        template.id,
        template.current_version_id,
        template.target_kind,
        template.asset_id,
        template.accommodation_id,
        actorUserId,
        template.signoff_required,
      ],
    );
    const occurrenceId = inserted.rows[0].id;

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "inspection.occurrence.start",
      permissionKey: "inspection.perform",
      riskLevel: "standard",
      subjectType: "inspection.occurrence",
      subjectId: occurrenceId,
      metadata: {
        templateId: template.id,
        templateVersionId: template.current_version_id,
      },
    });
    await client.query("commit");
    return occurrenceId;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordInspectionResult({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  occurrenceId,
  templateItemId,
  ...input
}) {
  await assertPermission(actorUserId, campgroundId, "inspection.perform");
  const result = validateInspectionResultInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);

    const saved = await client.query(
      `insert into public.inspection_results (
         organization_id,campground_id,occurrence_id,template_item_id,
         result_value,note,recorded_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (occurrence_id,template_item_id)
       do update set
         result_value=excluded.result_value,
         note=excluded.note,
         recorded_by_user_id=excluded.recorded_by_user_id
       returning id,row_version`,
      [
        campground.organization_id,
        campgroundId,
        occurrenceId,
        templateItemId,
        result.resultValue,
        result.note,
        actorUserId,
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "inspection.result.record",
      permissionKey: "inspection.perform",
      riskLevel: "standard",
      subjectType: "inspection.occurrence",
      subjectId: occurrenceId,
      metadata: {
        resultId: saved.rows[0].id,
        templateItemId,
        resultValue: result.resultValue,
      },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function submitInspection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  occurrenceId,
  expectedRowVersion,
}) {
  await assertPermission(actorUserId, campgroundId, "inspection.perform");
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Inspection occurrence row version is invalid.");
  }
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);

    const occurrenceResult = await client.query(
      `select
         o.*,
         t.name as template_name,
         v.version_number,
         v.failure_category_id,
         v.failure_priority_policy_id,
         p.target_response_minutes,
         p.target_completion_minutes
       from public.inspection_occurrences o
       join public.inspection_templates t on t.id=o.template_id
       join public.inspection_template_versions v on v.id=o.template_version_id
       join public.maintenance_priority_policies p
         on p.id=v.failure_priority_policy_id
       where o.id=$1 and o.campground_id=$2
       limit 1
       for update of o`,
      [occurrenceId, campgroundId],
    );
    if (occurrenceResult.rowCount !== 1) {
      throw new Error("Inspection occurrence is unavailable.");
    }
    const occurrence = occurrenceResult.rows[0];
    if (occurrence.status !== "in_progress") {
      throw new Error("Only an in-progress inspection can be submitted.");
    }
    if (occurrence.inspector_user_id !== actorUserId) {
      throw new Error("Only the assigned inspector can submit this inspection.");
    }

    const missingResult = await client.query(
      `select i.id,i.label
       from public.inspection_template_items i
       left join public.inspection_results r
         on r.template_item_id=i.id
        and r.occurrence_id=$1
       where i.template_version_id=$2
         and i.required
         and r.id is null
       order by i.position
       limit 1`,
      [occurrenceId, occurrence.template_version_id],
    );
    if (missingResult.rowCount > 0) {
      throw new Error(
        `Required inspection item is unanswered: ${missingResult.rows[0].label}`,
      );
    }

    const failures = await client.query(
      `select
         r.id as result_id,
         r.note,
         i.label,
         i.failure_creates_work_order,
         ca.id as corrective_action_id
       from public.inspection_results r
       join public.inspection_template_items i on i.id=r.template_item_id
       left join public.inspection_corrective_actions ca
         on ca.inspection_result_id=r.id
       where r.occurrence_id=$1
         and r.result_value='fail'
         and i.failure_creates_work_order
       order by i.position`,
      [occurrenceId],
    );

    if (failures.rows.some((row) => row.corrective_action_id == null)) {
      const permissionResult = await client.query(
        `select icamp_private.has_campground_permission(
           $1,
           'maintenance.create'
         ) as allowed`,
        [campgroundId],
      );
      if (permissionResult.rows[0]?.allowed !== true) {
        throw new Error(
          "Failed inspection items require maintenance.create authority so corrective work orders can be created.",
        );
      }
    }

    for (const failure of failures.rows) {
      if (failure.corrective_action_id) continue;

      const workOrder = await client.query(
        `insert into public.maintenance_work_orders (
           organization_id,campground_id,category_id,priority_policy_id,
           asset_id,accommodation_id,title,description,status,
           response_due_at,completion_due_at,
           created_by_user_id,updated_by_user_id
         )
         values (
           $1,$2,$3,$4,$5,$6,$7,$8,'open',
           statement_timestamp() + make_interval(mins => $9::int),
           statement_timestamp() + make_interval(mins => $10::int),
           $11,$11
         )
         returning id`,
        [
          campground.organization_id,
          campgroundId,
          occurrence.failure_category_id,
          occurrence.failure_priority_policy_id,
          occurrence.asset_id,
          occurrence.accommodation_id,
          `Inspection corrective action — ${failure.label}`,
          [
            `Inspection: ${occurrence.template_name} v${occurrence.version_number}.`,
            failure.note ? `Inspector note: ${failure.note}` : null,
          ]
            .filter(Boolean)
            .join(" "),
          Number(occurrence.target_response_minutes),
          Number(occurrence.target_completion_minutes),
          actorUserId,
        ],
      );
      const workOrderId = workOrder.rows[0].id;

      await client.query(
        `insert into public.maintenance_work_order_status_events (
           organization_id,campground_id,work_order_id,from_status,to_status,
           actor_user_id,note
         )
         values ($1,$2,$3,null,'open',$4,$5)`,
        [
          campground.organization_id,
          campgroundId,
          workOrderId,
          actorUserId,
          "Created from failed inspection checklist item",
        ],
      );

      await client.query(
        `insert into public.inspection_corrective_actions (
           organization_id,campground_id,inspection_result_id,work_order_id,
           created_by_user_id
         )
         values ($1,$2,$3,$4,$5)`,
        [
          campground.organization_id,
          campgroundId,
          failure.result_id,
          workOrderId,
          actorUserId,
        ],
      );
    }

    const nextStatus = occurrence.signoff_required
      ? "submitted"
      : "signed_off";
    const updated = await client.query(
      `update public.inspection_occurrences
       set
         status=$4,
         submitted_at=statement_timestamp(),
         submitted_by_user_id=$5,
         finalized_at=case when $4='signed_off' then statement_timestamp() else null end,
         finalized_by_user_id=case when $4='signed_off' then $5 else null end
       where id=$1
         and campground_id=$2
         and row_version=$3
       returning row_version`,
      [occurrenceId, campgroundId, expected, nextStatus, actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Inspection changed since this page loaded. Refresh and try again.",
      );
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "inspection.occurrence.submit",
      permissionKey: "inspection.perform",
      riskLevel: "standard",
      subjectType: "inspection.occurrence",
      subjectId: occurrenceId,
      afterState: {
        status: nextStatus,
        failedCorrectiveActions: failures.rowCount,
      },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function signOffInspection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  occurrenceId,
  expectedRowVersion,
  ...input
}) {
  await assertPermission(actorUserId, campgroundId, "inspection.signoff");
  const signoff = validateInspectionSignoffInput(input);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Inspection occurrence row version is invalid.");
  }
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);

    const occurrenceResult = await client.query(
      `select *
       from public.inspection_occurrences
       where id=$1 and campground_id=$2
       limit 1
       for update`,
      [occurrenceId, campgroundId],
    );
    if (occurrenceResult.rowCount !== 1) {
      throw new Error("Inspection occurrence is unavailable.");
    }
    const occurrence = occurrenceResult.rows[0];
    if (occurrence.status !== "submitted") {
      throw new Error("Inspection is not awaiting sign-off.");
    }
    if (occurrence.inspector_user_id === actorUserId) {
      throw new Error("Inspector cannot sign off their own inspection.");
    }

    const signoffResult = await client.query(
      `insert into public.inspection_signoffs (
         organization_id,campground_id,occurrence_id,decision,note,
         signed_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6)
       returning id`,
      [
        campground.organization_id,
        campgroundId,
        occurrenceId,
        signoff.decision,
        signoff.note,
        actorUserId,
      ],
    );

    const nextStatus =
      signoff.decision === "approved" ? "signed_off" : "rejected";
    const updated = await client.query(
      `update public.inspection_occurrences
       set
         status=$4,
         finalized_at=statement_timestamp(),
         finalized_by_user_id=$5
       where id=$1
         and campground_id=$2
         and row_version=$3
       returning row_version`,
      [occurrenceId, campgroundId, expected, nextStatus, actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Inspection changed since this page loaded. Refresh and try again.",
      );
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "inspection.occurrence.signoff",
      permissionKey: "inspection.signoff",
      riskLevel: "elevated",
      subjectType: "inspection.occurrence",
      subjectId: occurrenceId,
      metadata: {
        signoffId: signoffResult.rows[0].id,
        decision: signoff.decision,
      },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
