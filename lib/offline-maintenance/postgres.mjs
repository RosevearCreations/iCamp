import { createHash } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { validateInspectionResultInput } from "../inspections/core.mjs";
import { validateMaintenanceNote } from "../maintenance-work-orders/core.mjs";
import { validateOfflineMaintenanceOperation } from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for offline maintenance.");
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

export async function closeOfflineMaintenancePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function allowed(userId, campgroundId, permission) {
  return hasCampgroundPermission(userId, campgroundId, permission);
}

async function assertPermission(userId, campgroundId, permission) {
  if (!(await allowed(userId, campgroundId, permission))) {
    throw new Error(
      "OFFLINE_FORBIDDEN: Not authorized for " + permission + ".",
    );
  }
}

async function assertEvidencePermission(userId, campgroundId) {
  const checks = await Promise.all(
    ["maintenance.create", "maintenance.assign", "maintenance.complete"].map(
      (permission) => allowed(userId, campgroundId, permission),
    ),
  );
  if (!checks.some(Boolean)) {
    throw new Error(
      "OFFLINE_FORBIDDEN: Not authorized to add maintenance evidence.",
    );
  }
}

async function assertCanRead(userId, campgroundId) {
  const checks = await Promise.all(
    [
      "maintenance.read",
      "maintenance.create",
      "maintenance.assign",
      "maintenance.complete",
      "inspection.perform",
      "maintenance.offline.media",
    ].map((permission) => allowed(userId, campgroundId, permission)),
  );
  if (!checks.some(Boolean)) {
    throw new Error(
      "OFFLINE_FORBIDDEN: Not authorized to use offline maintenance.",
    );
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
    throw new Error("OFFLINE_NOT_FOUND: Campground is unavailable.");
  }
  return result.rows[0];
}

async function beginRls(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
}

function groupRows(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row[key]) ?? [];
    list.push(row);
    grouped.set(row[key], list);
  }
  return grouped;
}

function stablePayload(operation) {
  if (operation.operationKind === "work_order_note") {
    return {
      campgroundId: operation.campgroundId,
      expectedWorkOrderRowVersion: operation.expectedWorkOrderRowVersion,
      note: operation.note,
      operationKind: operation.operationKind,
      targetId: operation.targetId,
    };
  }
  if (operation.operationKind === "inspection_result") {
    return {
      campgroundId: operation.campgroundId,
      expectedOccurrenceRowVersion: operation.expectedOccurrenceRowVersion,
      expectedResultRowVersion: operation.expectedResultRowVersion,
      note: operation.note,
      operationKind: operation.operationKind,
      resultValue: operation.resultValue,
      targetId: operation.targetId,
      templateItemId: operation.templateItemId,
    };
  }
  return {
    campgroundId: operation.campgroundId,
    caption: operation.caption,
    expectedWorkOrderRowVersion: operation.expectedWorkOrderRowVersion,
    fileChecksumSha256: operation.fileChecksumSha256,
    operationKind: operation.operationKind,
    targetId: operation.targetId,
  };
}

export function offlineOperationFingerprint(operationInput) {
  const operation = validateOfflineMaintenanceOperation(operationInput);
  return createHash("sha256")
    .update(JSON.stringify(stablePayload(operation)))
    .digest("hex");
}

function mapReceipt(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientOperationId: row.client_operation_id,
    operationKind: row.operation_kind,
    targetId: row.target_id,
    payloadFingerprint: row.payload_fingerprint,
    resultEntityId: row.result_entity_id ?? null,
    appliedAt: row.applied_at,
  };
}

async function receiptFor(client, actorUserId, operation) {
  const result = await client.query(
    `select *
     from public.maintenance_offline_sync_receipts
     where actor_user_id=$1
       and campground_id=$2
       and client_operation_id=$3
     limit 1`,
    [actorUserId, operation.campgroundId, operation.clientOperationId],
  );
  return mapReceipt(result.rows[0]);
}

function assertMatchingReceipt(receipt, operation, fingerprint) {
  if (
    receipt.operationKind !== operation.operationKind ||
    receipt.targetId !== operation.targetId ||
    receipt.payloadFingerprint !== fingerprint
  ) {
    throw new Error(
      "OFFLINE_CONFLICT: Client operation ID was already used for different maintenance evidence.",
    );
  }
}

export async function getOfflineSyncReceipt({ actorUserId, operation: input }) {
  const operation = validateOfflineMaintenanceOperation(input);
  const fingerprint = offlineOperationFingerprint(operation);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await beginRls(client, actorUserId);
    const receipt = await receiptFor(client, actorUserId, operation);
    await client.query("commit");
    if (receipt) assertMatchingReceipt(receipt, operation, fingerprint);
    return receipt;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getOfflineMaintenanceWorkspace(userId, campgroundId) {
  await assertCanRead(userId, campgroundId);
  const capabilities = {
    notes: (
      await Promise.all(
        [
          "maintenance.create",
          "maintenance.assign",
          "maintenance.complete",
        ].map((permission) => allowed(userId, campgroundId, permission)),
      )
    ).some(Boolean),
    inspections: await allowed(userId, campgroundId, "inspection.perform"),
    media: await allowed(userId, campgroundId, "maintenance.offline.media"),
  };

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, userId);

    const [workOrdersResult, occurrenceResult] = await Promise.all([
      client.query(
        `select
           w.id,w.title,w.description,w.status,w.assigned_to_user_id,
           w.response_due_at,w.completion_due_at,w.row_version,w.updated_at,
           c.display_name as category_name,p.priority_key,
           s.name as section_name,a.display_name as asset_name,
           ac.code as accommodation_code,ac.display_name as accommodation_name,
           w.location_description
         from public.maintenance_work_orders w
         join public.maintenance_categories c on c.id=w.category_id
         join public.maintenance_priority_policies p on p.id=w.priority_policy_id
         left join public.campground_sections s on s.id=w.section_id
         left join public.operational_assets a on a.id=w.asset_id
         left join public.accommodations ac on ac.id=w.accommodation_id
         where w.campground_id=$1
           and w.assigned_to_user_id=$2
           and w.status in ('assigned','in_progress','blocked')
         order by
           case p.priority_key
             when 'emergency' then 1
             when 'urgent' then 2
             when 'normal' then 3
             else 4
           end,
           w.completion_due_at`,
        [campgroundId, userId],
      ),
      client.query(
        `select
           o.id,o.template_id,o.template_version_id,o.status,
           o.row_version,o.started_at,o.signoff_required,
           t.name as template_name,v.version_number,
           coalesce(a.display_name,ac.code || ' · ' || ac.display_name) as target_label
         from public.inspection_occurrences o
         join public.inspection_templates t on t.id=o.template_id
         join public.inspection_template_versions v on v.id=o.template_version_id
         left join public.operational_assets a on a.id=o.asset_id
         left join public.accommodations ac on ac.id=o.accommodation_id
         where o.campground_id=$1
           and o.inspector_user_id=$2
           and o.status='in_progress'
         order by o.started_at desc`,
        [campgroundId, userId],
      ),
    ]);

    const workOrderIds = workOrdersResult.rows.map((row) => row.id);
    const occurrenceIds = occurrenceResult.rows.map((row) => row.id);
    const versionIds = occurrenceResult.rows.map(
      (row) => row.template_version_id,
    );

    const [notesResult, itemsResult, resultsResult] = await Promise.all([
      workOrderIds.length
        ? client.query(
            `select work_order_id,id,note_text,created_at
             from public.maintenance_work_order_notes
             where work_order_id=any($1::uuid[])
             order by created_at desc`,
            [workOrderIds],
          )
        : { rows: [] },
      versionIds.length
        ? client.query(
            `select id,template_version_id,item_key,position,label,required
             from public.inspection_template_items
             where template_version_id=any($1::uuid[])
             order by template_version_id,position`,
            [versionIds],
          )
        : { rows: [] },
      occurrenceIds.length
        ? client.query(
            `select
               id,occurrence_id,template_item_id,result_value,note,row_version,
               updated_at
             from public.inspection_results
             where occurrence_id=any($1::uuid[])`,
            [occurrenceIds],
          )
        : { rows: [] },
    ]);

    await client.query("commit");

    const notesByOrder = groupRows(notesResult.rows, "work_order_id");
    const itemsByVersion = groupRows(itemsResult.rows, "template_version_id");
    const resultsByOccurrence = groupRows(resultsResult.rows, "occurrence_id");

    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        name: campground.name,
        timezone: campground.timezone,
      },
      generatedAt: new Date().toISOString(),
      capabilities,
      workOrders: workOrdersResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? null,
        status: row.status,
        categoryName: row.category_name,
        priorityKey: row.priority_key,
        locationLabel: [
          row.section_name,
          row.asset_name,
          row.accommodation_code && row.accommodation_name
            ? row.accommodation_code + " · " + row.accommodation_name
            : row.accommodation_name,
          row.location_description,
        ]
          .filter(Boolean)
          .join(" · "),
        responseDueAt: row.response_due_at,
        completionDueAt: row.completion_due_at,
        rowVersion: Number(row.row_version),
        updatedAt: row.updated_at,
        notes: (notesByOrder.get(row.id) ?? []).slice(0, 10).map((note) => ({
          id: note.id,
          noteText: note.note_text,
          createdAt: note.created_at,
        })),
      })),
      inspections: occurrenceResult.rows.map((row) => {
        const resultByItem = new Map(
          (resultsByOccurrence.get(row.id) ?? []).map((result) => [
            result.template_item_id,
            result,
          ]),
        );
        return {
          id: row.id,
          templateName: row.template_name,
          versionNumber: Number(row.version_number),
          targetLabel: row.target_label ?? "Inspection target",
          status: row.status,
          rowVersion: Number(row.row_version),
          startedAt: row.started_at,
          signoffRequired: row.signoff_required === true,
          items: (itemsByVersion.get(row.template_version_id) ?? []).map(
            (item) => {
              const result = resultByItem.get(item.id);
              return {
                id: item.id,
                itemKey: item.item_key,
                position: Number(item.position),
                label: item.label,
                required: item.required === true,
                result: result
                  ? {
                      id: result.id,
                      resultValue: result.result_value,
                      note: result.note ?? null,
                      rowVersion: Number(result.row_version),
                      updatedAt: result.updated_at,
                    }
                  : null,
              };
            },
          ),
        };
      }),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function syncOfflineMaintenanceOperation({
  actorUserId,
  actorSessionId = null,
  operation: input,
}) {
  const operation = validateOfflineMaintenanceOperation(input);
  if (operation.operationKind === "work_order_media") {
    throw new Error(
      "OFFLINE_MEDIA_ROUTE: Queued media must use the restricted media sync route.",
    );
  }

  if (operation.operationKind === "work_order_note") {
    await assertEvidencePermission(actorUserId, operation.campgroundId);
  } else {
    await assertPermission(
      actorUserId,
      operation.campgroundId,
      "inspection.perform",
    );
  }

  const fingerprint = offlineOperationFingerprint(operation);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, operation.campgroundId);
    await beginRls(client, actorUserId);

    const existingReceipt = await receiptFor(client, actorUserId, operation);
    if (existingReceipt) {
      assertMatchingReceipt(existingReceipt, operation, fingerprint);
      await client.query("commit");
      return { status: "already_applied", receipt: existingReceipt };
    }

    let resultEntityId;

    if (operation.operationKind === "work_order_note") {
      const orderResult = await client.query(
        `select id,organization_id,status,assigned_to_user_id,row_version
         from public.maintenance_work_orders
         where id=$1 and campground_id=$2
         limit 1
         for update`,
        [operation.targetId, operation.campgroundId],
      );
      const order = orderResult.rows[0];
      if (!order || order.assigned_to_user_id !== actorUserId) {
        throw new Error(
          "OFFLINE_CONFLICT: Work order is no longer assigned to this device user.",
        );
      }
      if (["completed", "cancelled"].includes(order.status)) {
        throw new Error(
          "OFFLINE_CONFLICT: Closed work orders cannot accept queued notes.",
        );
      }
      if (Number(order.row_version) !== operation.expectedWorkOrderRowVersion) {
        throw new Error(
          "OFFLINE_CONFLICT: Work order changed after it was cached. Refresh before applying the queued note.",
        );
      }

      const noteText = validateMaintenanceNote(operation.note);
      const inserted = await client.query(
        `insert into public.maintenance_work_order_notes (
           organization_id,campground_id,work_order_id,note_text,
           created_by_user_id
         ) values ($1,$2,$3,$4,$5)
         returning id`,
        [
          order.organization_id,
          operation.campgroundId,
          operation.targetId,
          noteText,
          actorUserId,
        ],
      );
      resultEntityId = inserted.rows[0].id;
    } else {
      const occurrenceResult = await client.query(
        `select id,organization_id,status,inspector_user_id,row_version
         from public.inspection_occurrences
         where id=$1 and campground_id=$2
         limit 1
         for update`,
        [operation.targetId, operation.campgroundId],
      );
      const occurrence = occurrenceResult.rows[0];
      if (!occurrence || occurrence.inspector_user_id !== actorUserId) {
        throw new Error(
          "OFFLINE_CONFLICT: Inspection is no longer assigned to this device user.",
        );
      }
      if (occurrence.status !== "in_progress") {
        throw new Error(
          "OFFLINE_CONFLICT: Finalized or submitted inspections cannot accept queued checklist edits.",
        );
      }
      if (
        Number(occurrence.row_version) !==
        operation.expectedOccurrenceRowVersion
      ) {
        throw new Error(
          "OFFLINE_CONFLICT: Inspection changed after it was cached. Refresh before applying checklist edits.",
        );
      }

      const currentResult = await client.query(
        `select id,row_version
         from public.inspection_results
         where occurrence_id=$1 and template_item_id=$2
         limit 1
         for update`,
        [operation.targetId, operation.templateItemId],
      );
      const current = currentResult.rows[0] ?? null;
      if (
        (current === null && operation.expectedResultRowVersion !== null) ||
        (current !== null &&
          Number(current.row_version) !== operation.expectedResultRowVersion)
      ) {
        throw new Error(
          "OFFLINE_CONFLICT: This checklist item changed after it was cached. Refresh before overwriting it.",
        );
      }

      const result = validateInspectionResultInput({
        resultValue: operation.resultValue,
        note: operation.note,
      });
      const saved = await client.query(
        `insert into public.inspection_results (
           organization_id,campground_id,occurrence_id,template_item_id,
           result_value,note,recorded_by_user_id
         ) values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (occurrence_id,template_item_id)
         do update set
           result_value=excluded.result_value,
           note=excluded.note,
           recorded_by_user_id=excluded.recorded_by_user_id
         returning id,row_version`,
        [
          occurrence.organization_id,
          operation.campgroundId,
          operation.targetId,
          operation.templateItemId,
          result.resultValue,
          result.note,
          actorUserId,
        ],
      );
      resultEntityId = saved.rows[0].id;
    }

    const receiptResult = await client.query(
      `insert into public.maintenance_offline_sync_receipts (
         organization_id,campground_id,actor_user_id,client_operation_id,
         operation_kind,target_id,payload_fingerprint,result_entity_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning *`,
      [
        campground.organization_id,
        operation.campgroundId,
        actorUserId,
        operation.clientOperationId,
        operation.operationKind,
        operation.targetId,
        fingerprint,
        resultEntityId,
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId: operation.campgroundId,
      actionKey: "maintenance.offline.sync.apply",
      permissionKey:
        operation.operationKind === "inspection_result"
          ? "inspection.perform"
          : "maintenance.create",
      riskLevel: "standard",
      subjectType:
        operation.operationKind === "inspection_result"
          ? "inspection.occurrence"
          : "maintenance.work_order",
      subjectId: operation.targetId,
      metadata: {
        clientOperationId: operation.clientOperationId,
        operationKind: operation.operationKind,
        resultEntityId,
      },
    });

    await client.query("commit");
    return { status: "applied", receipt: mapReceipt(receiptResult.rows[0]) };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function attachOfflineMaintenanceMediaEvidence({
  actorUserId,
  actorSessionId = null,
  operation: input,
  media,
}) {
  const operation = validateOfflineMaintenanceOperation(input);
  if (operation.operationKind !== "work_order_media") {
    throw new Error("Offline media evidence operation is invalid.");
  }
  await Promise.all([
    assertEvidencePermission(actorUserId, operation.campgroundId),
    assertPermission(
      actorUserId,
      operation.campgroundId,
      "maintenance.offline.media",
    ),
  ]);

  if (
    media.id !== operation.clientOperationId ||
    media.checksumSha256 !== operation.fileChecksumSha256
  ) {
    throw new Error(
      "Offline media identity does not match the queued operation.",
    );
  }

  const fingerprint = offlineOperationFingerprint(operation);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, operation.campgroundId);

    const existingReceiptResult = await client.query(
      `select *
       from public.maintenance_offline_sync_receipts
       where actor_user_id=$1
         and campground_id=$2
         and client_operation_id=$3
       limit 1`,
      [actorUserId, operation.campgroundId, operation.clientOperationId],
    );
    const existingReceipt = mapReceipt(existingReceiptResult.rows[0]);
    if (existingReceipt) {
      assertMatchingReceipt(existingReceipt, operation, fingerprint);
      await client.query("commit");
      return { status: "already_applied", receipt: existingReceipt };
    }

    const orderResult = await client.query(
      `select id,organization_id,status,assigned_to_user_id,row_version
       from public.maintenance_work_orders
       where id=$1 and campground_id=$2
       limit 1
       for update`,
      [operation.targetId, operation.campgroundId],
    );
    const order = orderResult.rows[0];
    if (!order || order.assigned_to_user_id !== actorUserId) {
      throw new Error(
        "OFFLINE_CONFLICT: Work order is no longer assigned to this device user.",
      );
    }
    if (["completed", "cancelled"].includes(order.status)) {
      throw new Error(
        "OFFLINE_CONFLICT: Closed work orders cannot accept queued media.",
      );
    }
    if (Number(order.row_version) !== operation.expectedWorkOrderRowVersion) {
      throw new Error(
        "OFFLINE_CONFLICT: Work order changed after it was cached. Refresh before applying queued media.",
      );
    }

    await client.query(
      `insert into icamp_private.media_assets (
         id,organization_id,campground_id,classification,media_kind,
         storage_provider,bucket_key,object_key,original_filename,content_type,
         byte_size,checksum_sha256,validation_state,lifecycle_state,
         created_by_user_id,activated_at
       ) values (
         $1,$2,$3,'internal',$4,'supabase',$5,$6,$7,$8,$9,$10,
         'validated','active',$11,statement_timestamp()
       )`,
      [
        media.id,
        campground.organization_id,
        operation.campgroundId,
        media.mediaKind,
        media.bucketKey,
        media.objectKey,
        media.originalFilename,
        media.contentType,
        media.byteSize,
        media.checksumSha256,
        actorUserId,
      ],
    );
    await client.query(
      `insert into icamp_private.media_lifecycle_events (
         media_asset_id,event_type,from_state,to_state,actor_user_id,reason,
         metadata
       ) values
         ($1,'registered',null,'pending',$2,$3,$4::jsonb),
         ($1,'activated','pending','active',$2,$3,$4::jsonb)`,
      [
        media.id,
        actorUserId,
        "Queued offline maintenance evidence synchronized after reconnect.",
        JSON.stringify({
          source: "maintenance.offline",
          clientOperationId: operation.clientOperationId,
        }),
      ],
    );

    await beginRls(client, actorUserId);
    const attached = await client.query(
      `insert into public.maintenance_work_order_media (
         organization_id,campground_id,work_order_id,media_asset_id,caption,
         created_by_user_id
       ) values ($1,$2,$3,$4,$5,$6)
       returning id`,
      [
        campground.organization_id,
        operation.campgroundId,
        operation.targetId,
        media.id,
        operation.caption,
        actorUserId,
      ],
    );
    const linkId = attached.rows[0].id;
    const receiptResult = await client.query(
      `insert into public.maintenance_offline_sync_receipts (
         organization_id,campground_id,actor_user_id,client_operation_id,
         operation_kind,target_id,payload_fingerprint,result_entity_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning *`,
      [
        campground.organization_id,
        operation.campgroundId,
        actorUserId,
        operation.clientOperationId,
        operation.operationKind,
        operation.targetId,
        fingerprint,
        linkId,
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId: operation.campgroundId,
      actionKey: "maintenance.offline.media.attach",
      permissionKey: "maintenance.offline.media",
      riskLevel: "standard",
      subjectType: "maintenance.work_order",
      subjectId: operation.targetId,
      metadata: {
        clientOperationId: operation.clientOperationId,
        mediaAssetId: media.id,
        workOrderMediaId: linkId,
      },
    });

    await client.query("commit");
    return { status: "applied", receipt: mapReceipt(receiptResult.rows[0]) };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
