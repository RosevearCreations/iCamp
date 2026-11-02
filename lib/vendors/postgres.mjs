import pg from "pg";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  assessVendorContract,
  assessVendorRecurring,
  assessVendorRequest,
  normalizeVendorContract,
  normalizeVendorEvent,
  normalizeVendorProfile,
  normalizeVendorRecurring,
  normalizeVendorRequest,
  vendorUuid,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for vendor evidence.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeVendorPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
export async function getVendorPermissions(actor, camp) {
  const keys = ["vendor.read", "vendor.manage", "vendor.invoice.review"];
  const [read, manage, invoiceReview] = await Promise.all(
    keys.map((key) => hasCampgroundPermission(actor, camp, key)),
  );
  return { read, manage, invoiceReview };
}
async function authorize(actor, camp, key) {
  if (!(await hasCampgroundPermission(actor, camp, key)))
    throw new Error(
      "VENDOR_FORBIDDEN: Insufficient campground vendor permission.",
    );
}
async function inScope(client, camp) {
  const r = await client.query(
    "select id,organization_id,name,timezone from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
    [vendorUuid(camp, "Campground ID")],
  );
  if (r.rowCount !== 1) throw new Error("Campground unavailable.");
  return r.rows[0];
}
async function withActor(actor, camp, fn) {
  const client = await database().connect();
  try {
    await client.query("begin");
    const campground = await inScope(client, camp);
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
    const result = await fn(client, campground);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
async function write(
  {
    actorUserId,
    actorSessionId = null,
    campgroundId,
    permissionKey,
    actionKey,
    subjectType,
  },
  fn,
) {
  await authorize(actorUserId, campgroundId, permissionKey);
  return withActor(actorUserId, campgroundId, async (client, camp) => {
    const outcome = await fn(client, camp);
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: camp.organization_id,
      campgroundId,
      actionKey,
      permissionKey,
      subjectType,
      subjectId: outcome.id,
      riskLevel:
        permissionKey === "vendor.invoice.review" ? "elevated" : "standard",
      metadata: outcome.metadata,
    });
    return { id: outcome.id };
  });
}
const date = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
const iso = (value) => (value ? new Date(value).toISOString() : null);
function mapProfile(r) {
  return {
    id: r.id,
    displayName: r.display_name,
    serviceCategory: r.service_category,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    privateNote: r.private_note,
    createdAt: iso(r.created_at),
  };
}
function mapContract(r) {
  return {
    id: r.id,
    vendorId: r.vendor_id,
    supersedesContractId: r.supersedes_contract_id,
    contractReference: r.contract_reference,
    title: r.title,
    validFrom: date(r.valid_from),
    expiresOn: date(r.expires_on),
    responseTargetHours: r.response_target_hours,
    completionTargetDays: r.completion_target_days,
    documentMediaId: r.document_media_id,
    privateNote: r.private_note,
    createdAt: iso(r.created_at),
  };
}
function mapRecurring(r) {
  return {
    id: r.id,
    vendorId: r.vendor_id,
    contractId: r.contract_id,
    supersedesPlanId: r.supersedes_plan_id,
    serviceLabel: r.service_label,
    cadenceDays: r.cadence_days,
    nextDueOn: date(r.next_due_on),
    privateNote: r.private_note,
    createdAt: iso(r.created_at),
  };
}
function mapRequest(r) {
  return {
    id: r.id,
    vendorId: r.vendor_id,
    contractId: r.contract_id,
    recurringPlanId: r.recurring_plan_id,
    workOrderId: r.work_order_id,
    title: r.title,
    requestDescription: r.request_description,
    responseTargetHours: r.response_target_hours,
    completionTargetDays: r.completion_target_days,
    requestedAt: iso(r.requested_at),
    responseDueAt: iso(r.response_due_at),
    completionDueAt: iso(r.completion_due_at),
  };
}
function mapEvent(r) {
  return {
    id: r.id,
    requestId: r.request_id,
    kind: r.kind,
    sourceReference: r.source_reference,
    note: r.note,
    evidenceMediaId: r.evidence_media_id,
    reviewsEventId: r.reviews_event_id,
    actorUserId: r.actor_user_id,
    recordedAt: iso(r.recorded_at),
  };
}

export async function getVendorDashboard(actorUserId, campgroundId) {
  const permissions = await getVendorPermissions(actorUserId, campgroundId);
  if (!Object.values(permissions).some(Boolean))
    throw new Error("VENDOR_FORBIDDEN: No private vendor access.");
  const [mediaAllowed, workAllowed] = await Promise.all([
    permissions.manage
      ? hasCampgroundPermission(
          actorUserId,
          campgroundId,
          "media.confidential.read",
        )
      : false,
    permissions.manage
      ? hasCampgroundPermission(actorUserId, campgroundId, "maintenance.read")
      : false,
  ]);
  return withActor(actorUserId, campgroundId, async (client, camp) => {
    const [profiles, contracts, plans, requests, events, docs, workOrders] =
      await Promise.all([
        client.query(
          "select * from icamp_private.vendor_profiles where campground_id=$1 order by display_name limit 250",
          [camp.id],
        ),
        client.query(
          "select * from icamp_private.vendor_contracts where campground_id=$1 order by expires_on limit 250",
          [camp.id],
        ),
        client.query(
          "select * from icamp_private.vendor_recurring_plans where campground_id=$1 order by next_due_on limit 250",
          [camp.id],
        ),
        client.query(
          "select * from icamp_private.vendor_service_requests where campground_id=$1 and requested_at>statement_timestamp()-interval '2 years' order by requested_at desc limit 250",
          [camp.id],
        ),
        client.query(
          "select * from icamp_private.vendor_service_events where campground_id=$1 and recorded_at>statement_timestamp()-interval '2 years' order by recorded_at desc limit 500",
          [camp.id],
        ),
        mediaAllowed
          ? client.query(
              "select id,original_filename from icamp_private.media_assets where campground_id=$1 and classification='confidential' and media_kind='document' and lifecycle_state='active' and validation_state='validated' order by created_at desc limit 100",
              [camp.id],
            )
          : { rows: [] },
        workAllowed
          ? client.query(
              "select id,title,status from public.maintenance_work_orders where campground_id=$1 and status not in ('cancelled') order by created_at desc limit 100",
              [camp.id],
            )
          : { rows: [] },
      ]);
    const asOf = new Date();
    const vendorProfiles = profiles.rows.map(mapProfile),
      vendorContracts = contracts.rows.map(mapContract),
      recurringPlans = plans.rows.map(mapRecurring);
    const serviceEvents = events.rows.map(mapEvent);
    const serviceRequests = requests.rows.map(mapRequest);
    return {
      asOf: asOf.toISOString(),
      campground: { id: camp.id, name: camp.name, timezone: camp.timezone },
      permissions,
      vendors: vendorProfiles,
      contracts: vendorContracts.map((row) => ({
        ...row,
        readiness: assessVendorContract(row, vendorContracts, asOf),
      })),
      recurringPlans: recurringPlans.map((row) => ({
        ...row,
        readiness: assessVendorRecurring(row, recurringPlans, asOf),
      })),
      requests: serviceRequests.map((row) => ({
        ...row,
        readiness: assessVendorRequest(row, serviceEvents, asOf),
      })),
      events: serviceEvents,
      documents: docs.rows.map((r) => ({
        id: r.id,
        label: r.original_filename,
      })),
      workOrders: workOrders.rows.map((r) => ({
        id: r.id,
        label: r.title,
        status: r.status,
      })),
    };
  });
}

export async function registerVendor({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const v = normalizeVendorProfile(input);
  return write(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "vendor.manage",
      actionKey: "vendor.profile.register",
      subjectType: "vendor.profile",
    },
    async (client, camp) => {
      await client.query(
        `insert into icamp_private.vendor_profiles
   (id,organization_id,campground_id,display_name,service_category,contact_name,contact_email,contact_phone,private_note,created_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          v.id,
          camp.organization_id,
          camp.id,
          v.displayName,
          v.serviceCategory,
          v.contactName,
          v.contactEmail,
          v.contactPhone,
          v.privateNote,
          actorUserId,
        ],
      );
      return { id: v.id, metadata: { serviceCategory: v.serviceCategory } };
    },
  );
}
export async function registerVendorContract({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const v = normalizeVendorContract(input);
  return write(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "vendor.manage",
      actionKey: "vendor.contract.register",
      subjectType: "vendor.contract",
    },
    async (client, camp) => {
      await client.query(
        `insert into icamp_private.vendor_contracts
   (id,organization_id,campground_id,vendor_id,supersedes_contract_id,contract_reference,title,valid_from,expires_on,response_target_hours,completion_target_days,document_media_id,private_note,created_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          v.id,
          camp.organization_id,
          camp.id,
          v.vendorId,
          v.supersedesContractId,
          v.contractReference,
          v.title,
          v.validFrom,
          v.expiresOn,
          v.responseTargetHours,
          v.completionTargetDays,
          v.documentMediaId,
          v.privateNote,
          actorUserId,
        ],
      );
      return {
        id: v.id,
        metadata: {
          vendorId: v.vendorId,
          validFrom: v.validFrom,
          expiresOn: v.expiresOn,
          documentMediaId: v.documentMediaId,
          supersedesContractId: v.supersedesContractId,
        },
      };
    },
  );
}
export async function registerVendorRecurring({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const v = normalizeVendorRecurring(input);
  return write(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "vendor.manage",
      actionKey: "vendor.recurring.plan",
      subjectType: "vendor.recurring",
    },
    async (client, camp) => {
      await client.query(
        `insert into icamp_private.vendor_recurring_plans
   (id,organization_id,campground_id,vendor_id,contract_id,supersedes_plan_id,service_label,cadence_days,next_due_on,private_note,created_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          v.id,
          camp.organization_id,
          camp.id,
          v.vendorId,
          v.contractId,
          v.supersedesPlanId,
          v.serviceLabel,
          v.cadenceDays,
          v.nextDueOn,
          v.privateNote,
          actorUserId,
        ],
      );
      return {
        id: v.id,
        metadata: {
          vendorId: v.vendorId,
          cadenceDays: v.cadenceDays,
          nextDueOn: v.nextDueOn,
        },
      };
    },
  );
}
export async function registerVendorRequest({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const v = normalizeVendorRequest(input);
  return write(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "vendor.manage",
      actionKey: "vendor.service.intake",
      subjectType: "vendor.service.request",
    },
    async (client, camp) => {
      await client.query(
        `insert into icamp_private.vendor_service_requests
   (id,organization_id,campground_id,vendor_id,contract_id,recurring_plan_id,work_order_id,title,request_description,response_target_hours,completion_target_days,response_due_at,completion_due_at,created_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,statement_timestamp(),statement_timestamp(),$12)`,
        [
          v.id,
          camp.organization_id,
          camp.id,
          v.vendorId,
          v.contractId,
          v.recurringPlanId,
          v.workOrderId,
          v.title,
          v.requestDescription,
          v.responseTargetHours,
          v.completionTargetDays,
          actorUserId,
        ],
      );
      return {
        id: v.id,
        metadata: {
          vendorId: v.vendorId,
          contractId: v.contractId,
          recurringPlanId: v.recurringPlanId,
          workOrderId: v.workOrderId,
        },
      };
    },
  );
}
export async function recordVendorEvent({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const e = normalizeVendorEvent(input);
  const permissionKey =
    e.kind === "invoice_reviewed" ? "vendor.invoice.review" : "vendor.manage";
  return write(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey,
      actionKey: "vendor.service." + e.kind,
      subjectType: "vendor.service.event",
    },
    async (client, camp) => {
      await client.query(
        `insert into icamp_private.vendor_service_events
   (id,organization_id,campground_id,request_id,kind,source_reference,note,evidence_media_id,reviews_event_id,actor_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          e.id,
          camp.organization_id,
          camp.id,
          e.requestId,
          e.kind,
          e.sourceReference,
          e.note,
          e.evidenceMediaId,
          e.reviewsEventId,
          actorUserId,
        ],
      );
      return {
        id: e.id,
        metadata: {
          requestId: e.requestId,
          kind: e.kind,
          sourceReference: e.sourceReference,
          reviewsEventId: e.reviewsEventId,
        },
      };
    },
  );
}
