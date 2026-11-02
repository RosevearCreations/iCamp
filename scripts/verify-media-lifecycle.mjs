import assert from "node:assert/strict";

import pg from "pg";

import {
  closeMediaPoolForTests,
  getMediaAccessDescriptor,
  getMediaStorageHealth,
  registerMediaAsset,
  transitionMediaAsset,
} from "../lib/media/postgres.mjs";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Build 008 verification.");
}

const setupPool = new Pool({ connectionString: databaseUrl, max: 2 });

async function createStaff(email) {
  const result = await setupPool.query(
    `insert into icamp_private.user_accounts (
       email_normalized,
       account_type
     )
     values ($1, 'staff')
     returning id`,
    [email],
  );

  return result.rows[0].id;
}

async function assignOwner(userId, organizationId, campgroundId) {
  const assignment = await setupPool.query(
    `insert into icamp_private.campground_assignments (
       user_id,
       organization_id,
       campground_id
     )
     values ($1, $2, $3)
     returning id`,
    [userId, organizationId, campgroundId],
  );

  const role = await setupPool.query(
    `select id
     from icamp_private.roles
     where role_kind = 'template'
       and role_code = 'owner_admin'
       and lifecycle_state = 'active'
     limit 1`,
  );

  assert.equal(role.rowCount, 1);

  await setupPool.query(
    `insert into icamp_private.campground_assignment_roles (
       assignment_id,
       role_id
     )
     values ($1, $2)`,
    [assignment.rows[0].id, role.rows[0].id],
  );
}

try {
  const organization = await setupPool.query(
    `insert into public.organizations (name, slug)
     values ('Build 008 Lifecycle Org', 'build-008-lifecycle-org')
     returning id`,
  );
  const organizationId = organization.rows[0].id;

  const campground = await setupPool.query(
    `insert into public.campgrounds (
       organization_id,
       name,
       slug,
       timezone
     )
     values (
       $1,
       'Build 008 Lifecycle Camp',
       'build-008-lifecycle-camp',
       'America/Toronto'
     )
     returning id`,
    [organizationId],
  );
  const campgroundId = campground.rows[0].id;

  const ownerId = await createStaff("build008-owner@example.test");
  const unassignedId = await createStaff("build008-unassigned@example.test");

  await assignOwner(ownerId, organizationId, campgroundId);

  await assert.rejects(
    () =>
      registerMediaAsset({
        actorUserId: unassignedId,
        organizationId,
        campgroundId,
        classification: "internal",
        mediaKind: "image",
        bucketKey: "icamp-internal-media",
        objectKey: organizationId + "/" + campgroundId + "/unauthorized.png",
        originalFilename: "unauthorized.png",
        contentType: "image/png",
        byteSize: 1024,
        checksumSha256: "a".repeat(64),
        reason: "Unauthorized registration must be rejected.",
      }),
    /Not authorized to manage media/,
  );

  const asset = await registerMediaAsset({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    classification: "internal",
    mediaKind: "image",
    bucketKey: "icamp-internal-media",
    objectKey: organizationId + "/" + campgroundId + "/lifecycle.png",
    originalFilename: "lifecycle.png",
    contentType: "image/png",
    byteSize: 1024,
    checksumSha256: "b".repeat(64),
    reason: "Verify Build 008 media registration lifecycle.",
  });

  assert.equal(asset.validationState, "validated");
  assert.equal(asset.lifecycleState, "pending");

  const active = await transitionMediaAsset({
    actorUserId: ownerId,
    mediaAssetId: asset.id,
    toState: "active",
    reason: "Activate verified Build 008 media fixture.",
  });
  assert.equal(active.lifecycleState, "active");
  assert.ok(active.activatedAt);

  const access = await getMediaAccessDescriptor(asset.id);
  assert.equal(access.classification, "internal");
  assert.equal(access.lifecycleState, "active");
  assert.equal(access.bucketKey, "icamp-internal-media");

  const quarantined = await transitionMediaAsset({
    actorUserId: ownerId,
    mediaAssetId: asset.id,
    toState: "quarantined",
    reason: "Quarantine fixture to verify lifecycle enforcement.",
  });
  assert.equal(quarantined.lifecycleState, "quarantined");

  const restored = await transitionMediaAsset({
    actorUserId: ownerId,
    mediaAssetId: asset.id,
    toState: "active",
    reason: "Restore fixture after quarantine verification.",
  });
  assert.equal(restored.lifecycleState, "active");

  const archived = await transitionMediaAsset({
    actorUserId: ownerId,
    mediaAssetId: asset.id,
    toState: "archived",
    reason: "Archive fixture to verify lifecycle evidence.",
  });
  assert.equal(archived.lifecycleState, "archived");
  assert.ok(archived.archivedAt);

  const deleted = await transitionMediaAsset({
    actorUserId: ownerId,
    mediaAssetId: asset.id,
    toState: "deleted",
    reason: "Delete fixture to verify terminal lifecycle state.",
  });
  assert.equal(deleted.lifecycleState, "deleted");
  assert.ok(deleted.deletedAt);

  await assert.rejects(
    () =>
      transitionMediaAsset({
        actorUserId: ownerId,
        mediaAssetId: asset.id,
        toState: "active",
        reason: "Deleted fixture must never be restored again.",
      }),
    /Unsupported media lifecycle transition/,
  );

  const events = await setupPool.query(
    `select event_type
     from icamp_private.media_lifecycle_events
     where media_asset_id = $1
     order by occurred_at, event_type`,
    [asset.id],
  );

  assert.equal(events.rowCount, 6);
  assert.deepEqual(
    new Set(events.rows.map((row) => row.event_type)),
    new Set([
      "registered",
      "activated",
      "quarantined",
      "restored",
      "archived",
      "deleted",
    ]),
  );

  await assert.rejects(
    () =>
      setupPool.query(
        `update icamp_private.media_lifecycle_events
         set reason = 'Mutation must fail.'
         where media_asset_id = $1`,
        [asset.id],
      ),
    /append-only/,
  );

  const health = await getMediaStorageHealth();
  assert.ok(health.registered >= 1);
  assert.ok(health.byClassification.internal >= 0);

  process.stdout.write(
    "Build 008 media metadata, authorization and lifecycle verification passed.\n",
  );
} finally {
  await closeMediaPoolForTests();
  await setupPool.end();
}
