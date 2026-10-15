import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeGuestPetInput,
  normalizeGuestProfileInput,
  normalizeGuestRvInput,
  normalizeGuestSourceChannel,
  normalizeGuestVehicleInput,
  normalizeSavedItemKind,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for guest profiles.");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function closeGuestProfilePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function accountType(userId) {
  const result = await getPool().query(
    `select account_type
     from icamp_private.user_accounts
     where id = $1 and account_state = 'active'`,
    [userId],
  );
  return result.rows[0]?.account_type ?? null;
}

async function assertGuestAccount(userId) {
  if ((await accountType(userId)) !== "guest") {
    throw new Error("An active guest account is required.");
  }
}

async function staffPermissions(userId, campgroundId) {
  const [read, manage] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "guest.read"),
    hasCampgroundPermission(userId, campgroundId, "guest.manage"),
  ]);
  return { read, manage };
}

async function assertStaffRead(userId, campgroundId) {
  const permissions = await staffPermissions(userId, campgroundId);
  if (!permissions.read && !permissions.manage) {
    throw new Error("Not authorized to read guest profiles.");
  }
  return permissions;
}

async function assertStaffManage(userId, campgroundId) {
  if (!(await hasCampgroundPermission(userId, campgroundId, "guest.manage"))) {
    throw new Error("Not authorized to manage guest profiles.");
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function iso(value) {
  if (value == null) return null;
  return new Date(value).toISOString();
}

function isoDate(value) {
  if (value == null) return null;
  return String(value).slice(0, 10);
}

function mapProfile(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    userAccountId: row.user_account_id ?? null,
    firstName: row.first_name,
    lastName: row.last_name,
    preferredName: row.preferred_name ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    preferredContactChannel: row.preferred_contact_channel,
    saveStayPreferences: row.save_stay_preferences === true,
    allowStaffProfileLookup: row.allow_staff_profile_lookup === true,
    profileState: row.profile_state,
    privacyUpdatedAt: iso(row.privacy_updated_at),
    rowVersion: Number(row.row_version),
  };
}

function mapRv(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    rvKind: row.rv_kind,
    make: row.make ?? null,
    model: row.model ?? null,
    modelYear: row.model_year == null ? null : Number(row.model_year),
    lengthFeet: row.length_feet == null ? null : Number(row.length_feet),
    slideOutCount: Number(row.slide_out_count),
    electricalServiceAmps:
      row.electrical_service_amps == null
        ? null
        : Number(row.electrical_service_amps),
    notes: row.notes ?? null,
    rowVersion: Number(row.row_version),
  };
}

function mapVehicle(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    vehicleKind: row.vehicle_kind,
    make: row.make ?? null,
    model: row.model ?? null,
    color: row.color ?? null,
    modelYear: row.model_year == null ? null : Number(row.model_year),
    notes: row.notes ?? null,
    rowVersion: Number(row.row_version),
  };
}

function mapPet(row) {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed ?? null,
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    notes: row.notes ?? null,
    rowVersion: Number(row.row_version),
  };
}

async function appendProfileEvent(
  client,
  {
    profile,
    actorUserId,
    eventKind,
    sourceChannel,
    summary,
    metadata = {},
  },
) {
  await client.query(
    `insert into public.guest_profile_events (
       organization_id,
       campground_id,
       guest_profile_id,
       event_kind,
       source_channel,
       summary,
       metadata,
       actor_user_id
     )
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [
      profile.organization_id ?? profile.organizationId,
      profile.campground_id ?? profile.campgroundId,
      profile.id,
      eventKind,
      sourceChannel,
      summary,
      JSON.stringify(metadata),
      actorUserId,
    ],
  );
}

async function campgroundScope(campgroundId) {
  const result = await getPool().query(
    `select organization_id,id,name
     from public.campgrounds
     where id = $1 and lifecycle_state = 'active'
     limit 1`,
    [campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Active campground was not found.");
  }
  return result.rows[0];
}

async function guestOwnsScope(userId, campgroundId) {
  const result = await getPool().query(
    `select 1
     where exists (
       select 1 from public.reservations
       where campground_id = $2 and guest_user_id = $1
     )
     or exists (
       select 1 from public.guest_profiles
       where campground_id = $2 and user_account_id = $1
     )`,
    [userId, campgroundId],
  );
  return result.rowCount === 1;
}

export async function listOwnGuestProfileScopes({ userId }) {
  await assertGuestAccount(userId);
  const result = await getPool().query(
    `with scopes as (
       select organization_id,campground_id
       from public.reservations
       where guest_user_id = $1
       union
       select organization_id,campground_id
       from public.guest_profiles
       where user_account_id = $1
     )
     select
       c.id campground_id,
       c.name campground_name,
       g.id profile_id,
       g.profile_state
     from scopes s
     join public.campgrounds c
       on c.organization_id = s.organization_id
      and c.id = s.campground_id
     left join public.guest_profiles g
       on g.organization_id = s.organization_id
      and g.campground_id = s.campground_id
      and g.user_account_id = $1
     order by c.name,c.id`,
    [userId],
  );
  return result.rows.map((row) => ({
    campgroundId: row.campground_id,
    campgroundName: row.campground_name,
    profileId: row.profile_id ?? null,
    profileState: row.profile_state ?? null,
  }));
}

export async function listGuestProfileDesk({ userId, campgroundId }) {
  const permissions = await assertStaffRead(userId, campgroundId);
  const result = await getPool().query(
    `select
       g.*,
       (select count(*) from public.guest_rv_profiles x
         where x.guest_profile_id=g.id and x.profile_state='active') rv_count,
       (select count(*) from public.guest_vehicle_profiles x
         where x.guest_profile_id=g.id and x.profile_state='active') vehicle_count,
       (select count(*) from public.guest_pet_profiles x
         where x.guest_profile_id=g.id and x.profile_state='active') pet_count,
       (select count(*) from public.reservations r
         where r.guest_profile_id=g.id
            or (g.user_account_id is not null and r.guest_user_id=g.user_account_id
                and r.campground_id=g.campground_id)) stay_count
     from public.guest_profiles g
     where g.campground_id=$1
       and g.profile_state='active'
       and ($2::boolean or g.allow_staff_profile_lookup)
     order by g.last_name,g.first_name,g.created_at desc`,
    [campgroundId, permissions.manage],
  );
  return result.rows.map((row) => ({
    ...mapProfile(row),
    rvCount: Number(row.rv_count),
    vehicleCount: Number(row.vehicle_count),
    petCount: Number(row.pet_count),
    stayCount: Number(row.stay_count),
  }));
}

async function resolveProfileAccess(actorUserId, campgroundId, profileId) {
  const result = await getPool().query(
    `select *
     from public.guest_profiles
     where campground_id=$1 and id=$2 and profile_state='active'
     limit 1`,
    [campgroundId, profileId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Guest profile was not found.");
  }
  const profile = result.rows[0];
  if (profile.user_account_id === actorUserId) {
    return { profile, owner: true, staffRead: false, staffManage: false };
  }
  const permissions = await staffPermissions(actorUserId, campgroundId);
  if (!permissions.read && !permissions.manage) {
    throw new Error("Not authorized to read this guest profile.");
  }
  return {
    profile,
    owner: false,
    staffRead: permissions.read,
    staffManage: permissions.manage,
  };
}

export async function getGuestProfileDetail({
  actorUserId,
  campgroundId,
  profileId,
}) {
  const access = await resolveProfileAccess(
    actorUserId,
    campgroundId,
    profileId,
  );
  const profile = access.profile;
  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const [rvs, vehicles, pets, stays, receipts, seasonal, events] =
      await Promise.all([
        client.query(
          `select * from public.guest_rv_profiles
           where guest_profile_id=$1 and profile_state='active'
           order by updated_at desc,nickname`,
          [profile.id],
        ),
        client.query(
          `select * from public.guest_vehicle_profiles
           where guest_profile_id=$1 and profile_state='active'
           order by updated_at desc,nickname`,
          [profile.id],
        ),
        client.query(
          `select * from public.guest_pet_profiles
           where guest_profile_id=$1 and profile_state='active'
           order by updated_at desc,name`,
          [profile.id],
        ),
        client.query(
          `select
             r.id,
             r.status,
             r.arrival_date,
             r.departure_date,
             r.source_channel,
             a.code accommodation_code,
             a.display_name accommodation_name,
             coalesce(rc.confirmation_number,'') confirmation_number,
             coalesce(rms.current_total_cents,rcd.quoted_total_cents,0) total_cents,
             coalesce(rms.currency_code,rcd.currency_code,'CAD') currency_code
           from public.reservations r
           join public.accommodations a on a.id=r.accommodation_id
           left join public.reservation_confirmations rc on rc.reservation_id=r.id
           left join public.reservation_management_state rms on rms.reservation_id=r.id
           left join public.reservation_checkout_details rcd on rcd.reservation_id=r.id
           where r.campground_id=$2
             and (
               r.guest_profile_id=$1
               or ($3::uuid is not null and r.guest_user_id=$3)
             )
           order by r.arrival_date desc,r.created_at desc
           limit 100`,
          [profile.id, campgroundId, profile.user_account_id],
        ),
        client.query(
          `select
             rr.id,
             rr.reservation_id,
             rr.receipt_number,
             rr.payment_purpose,
             rr.currency_code,
             rr.amount_cents,
             rr.issued_at
           from public.reservation_receipts rr
           join public.reservations r on r.id=rr.reservation_id
           where r.campground_id=$2
             and (
               r.guest_profile_id=$1
               or ($3::uuid is not null and r.guest_user_id=$3)
             )
           order by rr.issued_at desc
           limit 100`,
          [profile.id, campgroundId, profile.user_account_id],
        ),
        client.query(
          `select
             s.id,
             s.assignment_kind,
             s.assignment_state,
             s.occupancy_state,
             s.starts_on,
             s.ends_on,
             s.charge_amount_cents,
             s.currency_code,
             a.code accommodation_code,
             a.display_name accommodation_name
           from public.seasonal_assignments s
           join public.accommodations a on a.id=s.accommodation_id
           where s.campground_id=$2 and s.guest_profile_id=$1
           order by s.starts_on desc`,
          [profile.id, campgroundId],
        ),
        client.query(
          `select id,event_kind,source_channel,summary,metadata,occurred_at
           from public.guest_profile_events
           where guest_profile_id=$1
           order by occurred_at desc
           limit 50`,
          [profile.id],
        ),
      ]);
    await client.query("commit");
    return {
      profile: mapProfile(profile),
      rvs: rvs.rows.map(mapRv),
      vehicles: vehicles.rows.map(mapVehicle),
      pets: pets.rows.map(mapPet),
      stays: stays.rows.map((row) => ({
        id: row.id,
        status: row.status,
        arrivalDate: isoDate(row.arrival_date),
        departureDate: isoDate(row.departure_date),
        sourceChannel: row.source_channel,
        accommodationCode: row.accommodation_code,
        accommodationName: row.accommodation_name,
        confirmationNumber: row.confirmation_number || null,
        totalCents: Number(row.total_cents),
        currencyCode: row.currency_code,
      })),
      receipts: receipts.rows.map((row) => ({
        id: row.id,
        reservationId: row.reservation_id,
        receiptNumber: row.receipt_number,
        paymentPurpose: row.payment_purpose,
        currencyCode: row.currency_code,
        amountCents: Number(row.amount_cents),
        issuedAt: iso(row.issued_at),
      })),
      seasonalAssignments: seasonal.rows.map((row) => ({
        id: row.id,
        assignmentKind: row.assignment_kind,
        assignmentState: row.assignment_state,
        occupancyState: row.occupancy_state,
        startsOn: isoDate(row.starts_on),
        endsOn: isoDate(row.ends_on),
        chargeAmountCents:
          row.charge_amount_cents == null
            ? null
            : Number(row.charge_amount_cents),
        currencyCode: row.currency_code,
        accommodationCode: row.accommodation_code,
        accommodationName: row.accommodation_name,
      })),
      events: events.rows.map((row) => ({
        id: row.id,
        eventKind: row.event_kind,
        sourceChannel: row.source_channel,
        summary: row.summary,
        metadata: row.metadata,
        occurredAt: iso(row.occurred_at),
      })),
      canManage: access.owner || access.staffManage,
      owner: access.owner,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getOwnGuestProfileDetail({ userId, campgroundId }) {
  await assertGuestAccount(userId);
  const result = await getPool().query(
    `select id from public.guest_profiles
     where campground_id=$1 and user_account_id=$2 and profile_state='active'
     limit 1`,
    [campgroundId, userId],
  );
  if (result.rowCount !== 1) return null;
  return getGuestProfileDetail({
    actorUserId: userId,
    campgroundId,
    profileId: result.rows[0].id,
  });
}

export async function saveOwnGuestProfile({
  userId,
  campgroundId,
  input,
  expectedRowVersion = null,
  sourceChannel = "web",
}) {
  await assertGuestAccount(userId);
  if (!(await guestOwnsScope(userId, campgroundId))) {
    throw new Error(
      "Create a reservation before saving a campground guest profile.",
    );
  }
  const value = normalizeGuestProfileInput(input);
  const channel = normalizeGuestSourceChannel(sourceChannel);
  const scope = await campgroundScope(campgroundId);
  const client = await getPool().connect();

  try {
    await beginRls(client, userId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1,0))",
      ["icamp-guest-profile:" + campgroundId + ":" + userId],
    );
    const current = await client.query(
      `select * from public.guest_profiles
       where campground_id=$1 and user_account_id=$2
       for update`,
      [campgroundId, userId],
    );

    let saved;
    let eventKind;
    if (current.rowCount === 0) {
      const inserted = await client.query(
        `insert into public.guest_profiles (
           organization_id,campground_id,user_account_id,
           first_name,last_name,preferred_name,
           contact_email,contact_phone,preferred_contact_channel,
           save_stay_preferences,allow_staff_profile_lookup,
           created_by_user_id,updated_by_user_id
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$3,$3)
         returning *`,
        [
          scope.organization_id,
          campgroundId,
          userId,
          value.firstName,
          value.lastName,
          value.preferredName,
          value.contactEmail,
          value.contactPhone,
          value.preferredContactChannel,
          value.saveStayPreferences,
          value.allowStaffProfileLookup,
        ],
      );
      saved = inserted.rows[0];
      eventKind = "profile_created";
    } else {
      const before = current.rows[0];
      if (
        expectedRowVersion != null &&
        Number(before.row_version) !== Number(expectedRowVersion)
      ) {
        throw new Error(
          "Guest profile changed since this page loaded. Refresh and try again.",
        );
      }
      const updated = await client.query(
        `update public.guest_profiles
         set first_name=$3,
             last_name=$4,
             preferred_name=$5,
             contact_email=$6,
             contact_phone=$7,
             preferred_contact_channel=$8,
             save_stay_preferences=$9,
             allow_staff_profile_lookup=$10,
             updated_by_user_id=$2
         where campground_id=$1
           and user_account_id=$2
           and ($11::bigint is null or row_version=$11)
         returning *`,
        [
          campgroundId,
          userId,
          value.firstName,
          value.lastName,
          value.preferredName,
          value.contactEmail,
          value.contactPhone,
          value.preferredContactChannel,
          value.saveStayPreferences,
          value.allowStaffProfileLookup,
          expectedRowVersion,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error(
          "Guest profile changed since this page loaded. Refresh and try again.",
        );
      }
      saved = updated.rows[0];
      eventKind =
        before.save_stay_preferences !== value.saveStayPreferences ||
        before.allow_staff_profile_lookup !== value.allowStaffProfileLookup
          ? "privacy_updated"
          : "profile_updated";
    }

    await appendProfileEvent(client, {
      profile: saved,
      actorUserId: userId,
      eventKind,
      sourceChannel: channel,
      summary:
        eventKind === "privacy_updated"
          ? "Guest updated saved-stay privacy controls."
          : "Guest profile details saved.",
      metadata: {
        saveStayPreferences: value.saveStayPreferences,
        allowStaffProfileLookup: value.allowStaffProfileLookup,
      },
    });
    await client.query("commit");
    return mapProfile(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveStaffGuestProfile({
  actorUserId,
  campgroundId,
  profileId = null,
  accountEmail = null,
  input,
  expectedRowVersion = null,
  sourceChannel = "staff",
}) {
  await assertStaffManage(actorUserId, campgroundId);
  const value = normalizeGuestProfileInput(input);
  const channel = normalizeGuestSourceChannel(sourceChannel);
  const scope = await campgroundScope(campgroundId);
  const client = await getPool().connect();

  let linkedUserId = null;
  if (String(accountEmail ?? "").trim()) {
    const account = await getPool().query(
      `select id
       from icamp_private.user_accounts
       where email_normalized=lower(trim($1))
         and account_type='guest'
         and account_state='active'
       limit 1`,
      [accountEmail],
    );
    if (account.rowCount !== 1) {
      throw new Error("No active guest account matches that account email.");
    }
    linkedUserId = account.rows[0].id;
  }

  try {
    await beginRls(client, actorUserId);
    let saved;
    let eventKind;

    if (profileId) {
      const current = await client.query(
        `select * from public.guest_profiles
         where campground_id=$1 and id=$2
         for update`,
        [campgroundId, profileId],
      );
      if (current.rowCount !== 1) {
        throw new Error("Guest profile was not found.");
      }
      const before = current.rows[0];
      if (
        expectedRowVersion != null &&
        Number(before.row_version) !== Number(expectedRowVersion)
      ) {
        throw new Error(
          "Guest profile changed since this page loaded. Refresh and try again.",
        );
      }
      if (
        linkedUserId &&
        before.user_account_id &&
        before.user_account_id !== linkedUserId
      ) {
        throw new Error("A linked guest account cannot be reassigned.");
      }
      const updated = await client.query(
        `update public.guest_profiles
         set user_account_id=coalesce(user_account_id,$3),
             first_name=$4,
             last_name=$5,
             preferred_name=$6,
             contact_email=$7,
             contact_phone=$8,
             preferred_contact_channel=$9,
             save_stay_preferences=$10,
             allow_staff_profile_lookup=$11,
             updated_by_user_id=$12
         where campground_id=$1 and id=$2
           and ($13::bigint is null or row_version=$13)
         returning *`,
        [
          campgroundId,
          profileId,
          linkedUserId,
          value.firstName,
          value.lastName,
          value.preferredName,
          value.contactEmail,
          value.contactPhone,
          value.preferredContactChannel,
          value.saveStayPreferences,
          value.allowStaffProfileLookup,
          actorUserId,
          expectedRowVersion,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error(
          "Guest profile changed since this page loaded. Refresh and try again.",
        );
      }
      saved = updated.rows[0];
      eventKind =
        !before.user_account_id && linkedUserId
          ? "account_linked"
          : before.save_stay_preferences !== value.saveStayPreferences ||
              before.allow_staff_profile_lookup !== value.allowStaffProfileLookup
            ? "privacy_updated"
            : "profile_updated";
    } else {
      const inserted = await client.query(
        `insert into public.guest_profiles (
           organization_id,campground_id,user_account_id,
           first_name,last_name,preferred_name,
           contact_email,contact_phone,preferred_contact_channel,
           save_stay_preferences,allow_staff_profile_lookup,
           created_by_user_id,updated_by_user_id
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
         returning *`,
        [
          scope.organization_id,
          campgroundId,
          linkedUserId,
          value.firstName,
          value.lastName,
          value.preferredName,
          value.contactEmail,
          value.contactPhone,
          value.preferredContactChannel,
          value.saveStayPreferences,
          value.allowStaffProfileLookup,
          actorUserId,
        ],
      );
      saved = inserted.rows[0];
      eventKind = linkedUserId ? "account_linked" : "profile_created";
    }

    await appendProfileEvent(client, {
      profile: saved,
      actorUserId,
      eventKind,
      sourceChannel: channel,
      summary:
        eventKind === "account_linked"
          ? "Staff linked the guest profile to an optional guest account."
          : eventKind === "privacy_updated"
            ? "Staff updated guest profile privacy controls."
            : "Staff saved guest profile details.",
      metadata: {
        linkedAccount: Boolean(saved.user_account_id),
        saveStayPreferences: value.saveStayPreferences,
        allowStaffProfileLookup: value.allowStaffProfileLookup,
      },
    });

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: scope.organization_id,
      campgroundId,
      actionKey: "guest.profile.save",
      permissionKey: "guest.manage",
      riskLevel: "elevated",
      reason: "Save guest profile and privacy preferences.",
      subjectType: "guest_profile",
      subjectId: saved.id,
      beforeState: null,
      afterState: {
        linkedAccount: Boolean(saved.user_account_id),
        saveStayPreferences: saved.save_stay_preferences,
        allowStaffProfileLookup: saved.allow_staff_profile_lookup,
      },
      metadata: { sourceChannel: channel },
    });
    await client.query("commit");
    return mapProfile(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function assertProfileManage(actorUserId, campgroundId, profileId) {
  const access = await resolveProfileAccess(
    actorUserId,
    campgroundId,
    profileId,
  );
  if (!access.owner && !access.staffManage) {
    throw new Error("Not authorized to change saved stay information.");
  }
  if (!access.profile.save_stay_preferences) {
    throw new Error(
      "Saved stay information is disabled by this guest's privacy preference.",
    );
  }
  return access.profile;
}

async function saveItem({
  actorUserId,
  campgroundId,
  profileId,
  kind,
  input,
  sourceChannel,
}) {
  const profile = await assertProfileManage(
    actorUserId,
    campgroundId,
    profileId,
  );
  const channel = normalizeGuestSourceChannel(sourceChannel);
  const client = await getPool().connect();
  let eventKind;
  let summary;
  let sql;
  let values;

  if (kind === "rv") {
    const value = normalizeGuestRvInput(input);
    sql = `insert into public.guest_rv_profiles (
       organization_id,campground_id,guest_profile_id,nickname,rv_kind,
       make,model,model_year,length_feet,slide_out_count,
       electrical_service_amps,notes,created_by_user_id,updated_by_user_id
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
     returning *`;
    values = [
      profile.organization_id,
      campgroundId,
      profile.id,
      value.nickname,
      value.rvKind,
      value.make,
      value.model,
      value.modelYear,
      value.lengthFeet,
      value.slideOutCount,
      value.electricalServiceAmps,
      value.notes,
      actorUserId,
    ];
    eventKind = "rv_saved";
    summary = "Reusable RV stay information saved.";
  } else if (kind === "vehicle") {
    const value = normalizeGuestVehicleInput(input);
    sql = `insert into public.guest_vehicle_profiles (
       organization_id,campground_id,guest_profile_id,nickname,vehicle_kind,
       make,model,color,model_year,notes,created_by_user_id,updated_by_user_id
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
     returning *`;
    values = [
      profile.organization_id,
      campgroundId,
      profile.id,
      value.nickname,
      value.vehicleKind,
      value.make,
      value.model,
      value.color,
      value.modelYear,
      value.notes,
      actorUserId,
    ];
    eventKind = "vehicle_saved";
    summary =
      "Reusable vehicle description saved; formal registration remains Build 053.";
  } else {
    const value = normalizeGuestPetInput(input);
    sql = `insert into public.guest_pet_profiles (
       organization_id,campground_id,guest_profile_id,name,species,
       breed,weight_kg,notes,created_by_user_id,updated_by_user_id
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
     returning *`;
    values = [
      profile.organization_id,
      campgroundId,
      profile.id,
      value.name,
      value.species,
      value.breed,
      value.weightKg,
      value.notes,
      actorUserId,
    ];
    eventKind = "pet_saved";
    summary = "Reusable pet stay information saved.";
  }

  try {
    await beginRls(client, actorUserId);
    const inserted = await client.query(sql, values);
    await appendProfileEvent(client, {
      profile,
      actorUserId,
      eventKind,
      sourceChannel: channel,
      summary,
      metadata: { savedItemId: inserted.rows[0].id },
    });
    await client.query("commit");
    return inserted.rows[0].id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function saveGuestRvProfile(input) {
  return saveItem({ ...input, kind: "rv" });
}

export function saveGuestVehicleProfile(input) {
  return saveItem({ ...input, kind: "vehicle" });
}

export function saveGuestPetProfile(input) {
  return saveItem({ ...input, kind: "pet" });
}

export async function archiveGuestSavedItem({
  actorUserId,
  campgroundId,
  profileId,
  itemId,
  itemKind,
  expectedRowVersion,
  sourceChannel = "web",
}) {
  const profile = await resolveProfileAccess(
    actorUserId,
    campgroundId,
    profileId,
  );
  if (!profile.owner && !profile.staffManage) {
    throw new Error("Not authorized to archive saved stay information.");
  }
  const kind = normalizeSavedItemKind(itemKind);
  const channel = normalizeGuestSourceChannel(sourceChannel);
  const table =
    kind === "rv"
      ? "guest_rv_profiles"
      : kind === "vehicle"
        ? "guest_vehicle_profiles"
        : "guest_pet_profiles";
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    const updated = await client.query(
      `update public.${table}
       set profile_state='archived',
           archived_at=statement_timestamp(),
           updated_by_user_id=$4
       where campground_id=$1
         and guest_profile_id=$2
         and id=$3
         and profile_state='active'
         and row_version=$5
       returning id`,
      [
        campgroundId,
        profileId,
        itemId,
        actorUserId,
        Number(expectedRowVersion),
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Saved stay information changed since this page loaded. Refresh and try again.",
      );
    }
    await appendProfileEvent(client, {
      profile: profile.profile,
      actorUserId,
      eventKind: "saved_item_archived",
      sourceChannel: channel,
      summary: "Saved " + kind + " information archived.",
      metadata: { itemKind: kind, savedItemId: itemId },
    });
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function linkGuestProfileToReservation({
  actorUserId,
  campgroundId,
  profileId,
  reservationId,
  sourceChannel = "staff",
}) {
  await assertStaffManage(actorUserId, campgroundId);
  if (
    !(await hasCampgroundPermission(
      actorUserId,
      campgroundId,
      "reservation.modify",
    ))
  ) {
    throw new Error("Reservation modify permission is required.");
  }
  const access = await resolveProfileAccess(
    actorUserId,
    campgroundId,
    profileId,
  );
  const channel = normalizeGuestSourceChannel(sourceChannel);
  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const updated = await client.query(
      `update public.reservations
       set guest_profile_id=$3,updated_by_user_id=$4
       where campground_id=$1 and id=$2
       returning id`,
      [campgroundId, reservationId, profileId, actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Reservation was not found.");
    }
    await appendProfileEvent(client, {
      profile: access.profile,
      actorUserId,
      eventKind: "reservation_linked",
      sourceChannel: channel,
      summary: "Reservation linked to canonical guest profile.",
      metadata: { reservationId },
    });
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function linkGuestProfileToSeasonalAssignment({
  actorUserId,
  campgroundId,
  profileId,
  assignmentId,
  sourceChannel = "staff",
}) {
  await assertStaffManage(actorUserId, campgroundId);
  if (
    !(await hasCampgroundPermission(
      actorUserId,
      campgroundId,
      "seasonal.manage",
    ))
  ) {
    throw new Error("Seasonal manage permission is required.");
  }
  const access = await resolveProfileAccess(
    actorUserId,
    campgroundId,
    profileId,
  );
  const channel = normalizeGuestSourceChannel(sourceChannel);
  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const updated = await client.query(
      `update public.seasonal_assignments
       set guest_profile_id=$3,updated_by_user_id=$4
       where campground_id=$1 and id=$2
       returning id`,
      [campgroundId, assignmentId, profileId, actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Seasonal/yearly assignment was not found.");
    }
    await appendProfileEvent(client, {
      profile: access.profile,
      actorUserId,
      eventKind: "seasonal_assignment_linked",
      sourceChannel: channel,
      summary: "Seasonal/yearly assignment linked to canonical guest profile.",
      metadata: { assignmentId },
    });
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
