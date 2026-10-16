import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { myStayPhase, normalizeMyStaySettingsInput } from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for My Stay.");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeMyStayPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertGuestAccount(userId) {
  const result = await getPool().query(
    `
      select 1
      from icamp_private.user_accounts
      where id=$1 and account_type='guest' and account_state='active'
      limit 1
    `,
    [userId],
  );
  if (result.rowCount !== 1) {
    throw new Error("An active guest account is required for My Stay.");
  }
}

async function assertConfiguration(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(
      userId,
      campgroundId,
      "campground.configuration",
    ))
  ) {
    throw new Error("Not authorized to manage My Stay configuration.");
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function dateText(value) {
  return value == null ? null : String(value).slice(0, 10);
}

function timeText(value) {
  return value == null ? null : String(value).slice(0, 5);
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function moneyProgress(row) {
  const expected =
    row.total_payable_cents == null
      ? Number(row.current_total_cents ?? row.quoted_total_cents ?? 0)
      : Number(row.total_payable_cents);
  const captured = Number(row.captured_cents ?? 0);
  return {
    currencyCode: row.currency_code ?? row.checkout_currency_code ?? "CAD",
    expectedPayableCents: expected,
    capturedCents: captured,
    outstandingCents: Math.max(expected - captured, 0),
    balanceDueDate: dateText(row.balance_due_date),
  };
}

function mapSettings(row) {
  if (!row) {
    return {
      persisted: false,
      rowVersion: 0,
      guestRulesSummary: null,
      wifiNetworkName: null,
      wifiAccessInstructions: null,
      assistanceInstructions: null,
      storeUrl: null,
      rentalsUrl: null,
      eventsUrl: null,
      localInterestsUrl: null,
      assistanceUrl: null,
    };
  }

  return {
    persisted: true,
    rowVersion: Number(row.row_version),
    guestRulesSummary: row.guest_rules_summary ?? null,
    wifiNetworkName: row.wifi_network_name ?? null,
    wifiAccessInstructions: row.wifi_access_instructions ?? null,
    assistanceInstructions: row.assistance_instructions ?? null,
    storeUrl: row.store_url ?? null,
    rentalsUrl: row.rentals_url ?? null,
    eventsUrl: row.events_url ?? null,
    localInterestsUrl: row.local_interests_url ?? null,
    assistanceUrl: row.assistance_url ?? null,
  };
}

export async function listMyStays({ userId }) {
  await assertGuestAccount(userId);
  const result = await getPool().query(
    `
      select
        r.id,
        r.status,
        r.arrival_date,
        r.departure_date,
        c.name campground_name,
        c.slug campground_slug,
        to_char(
          statement_timestamp() at time zone c.timezone,
          'YYYY-MM-DD'
        ) campground_local_date,
        a.code accommodation_code,
        a.display_name accommodation_name,
        a.accommodation_kind,
        ci.checked_in_at,
        co.checked_out_at
      from public.reservations r
      join public.campgrounds c on c.id=r.campground_id
      join public.accommodations a on a.id=r.accommodation_id
      left join public.reservation_check_ins ci on ci.reservation_id=r.id
      left join public.reservation_check_outs co on co.reservation_id=r.id
      where r.guest_user_id=$1
        and r.status in ('pending','confirmed','checked_in','completed')
      order by
        case
          when r.status='checked_in' then 0
          when r.status='confirmed' then 1
          when r.status='pending' then 2
          else 3
        end,
        case when r.status='completed' then r.departure_date end desc,
        r.arrival_date,
        r.id
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    phase: myStayPhase({
      status: row.status,
      arrivalDate: dateText(row.arrival_date),
      departureDate: dateText(row.departure_date),
      localDate: row.campground_local_date,
    }),
    arrivalDate: dateText(row.arrival_date),
    departureDate: dateText(row.departure_date),
    campgroundLocalDate: row.campground_local_date,
    campgroundName: row.campground_name,
    campgroundSlug: row.campground_slug,
    accommodationCode: row.accommodation_code,
    accommodationName: row.accommodation_name,
    accommodationKind: row.accommodation_kind,
    checkedInAt: iso(row.checked_in_at),
    checkedOutAt: iso(row.checked_out_at),
  }));
}

async function guestSettings(client, userId, campgroundId) {
  await beginRls(client, userId);
  const result = await client.query(
    `
      select *
      from public.campground_my_stay_settings
      where campground_id=$1
      limit 1
    `,
    [campgroundId],
  );
  await client.query("commit");
  return mapSettings(result.rows[0]);
}

export async function getMyStayDetail({ userId, reservationId }) {
  await assertGuestAccount(userId);
  const client = await getPool().connect();

  try {
    const result = await client.query(
      `
        select
          r.id,
          r.organization_id,
          r.campground_id,
          r.accommodation_id,
          r.status,
          r.arrival_date,
          r.departure_date,
          r.row_version,
          c.name campground_name,
          c.slug campground_slug,
          c.timezone campground_timezone,
          to_char(
            statement_timestamp() at time zone c.timezone,
            'YYYY-MM-DD'
          ) campground_local_date,
          a.code accommodation_code,
          a.display_name accommodation_name,
          a.accommodation_kind,
          a.map_object_id,
          a.status_state accommodation_status_state,
          d.primary_first_name,
          d.primary_last_name,
          d.contact_email,
          d.contact_phone,
          d.occupant_count,
          d.visitor_count,
          d.pet_count,
          d.vehicle_count,
          d.booking_rules_snapshot,
          d.rules_acknowledged_at booking_rules_acknowledged_at,
          d.currency_code checkout_currency_code,
          d.quoted_total_cents,
          m.current_total_cents,
          m.currency_code,
          m.financial_review_required,
          m.financial_review_reason,
          ps.total_payable_cents,
          ps.balance_due_date,
          coalesce((
            select sum(p.amount_cents)
            from public.reservation_payments p
            where p.reservation_id=r.id
              and p.guest_user_id=$2
              and p.payment_state='captured'
          ),0)::bigint captured_cents,
          br.check_in_time,
          br.check_out_time,
          cs.campsite_type,
          cs.service_level,
          cs.is_waterfront,
          cs.electrical_amperage,
          cs.water_service,
          cs.wastewater_service,
          cs.wifi_service,
          cs.surface_type,
          cs.pull_through,
          cs.shade_level,
          cs.has_fire_ring,
          cs.has_picnic_table,
          rc.cottage_style,
          rc.bedroom_count,
          rc.bed_count,
          rc.max_occupancy cottage_max_occupancy,
          rc.kitchen_type,
          rc.washroom_type,
          rc.shower_type,
          rc.heating_type,
          rc.cooling_type,
          rc.has_refrigerator,
          rc.has_cooktop,
          rc.has_oven,
          rc.has_microwave,
          rc.step_free_access,
          rc.accessible_washroom,
          rc.view_type,
          ci.id check_in_id,
          ci.checked_in_at,
          ci.verified_occupant_count,
          ci.verified_visitor_count,
          ci.verified_pet_count,
          ci.verified_vehicle_count,
          ci.rules_acknowledged_at check_in_rules_acknowledged_at,
          ci.credential_handoff_state,
          co.id check_out_id,
          co.checked_out_at,
          co.financial_handoff_state,
          co.outstanding_balance_cents check_out_outstanding_balance_cents,
          co.rental_return_state,
          co.key_return_state,
          co.credential_return_state,
          co.turnover_state,
          conf.confirmation_number,
          inv.invoice_number
        from public.reservations r
        join public.campgrounds c on c.id=r.campground_id
        join public.accommodations a on a.id=r.accommodation_id
        left join public.reservation_checkout_details d on d.reservation_id=r.id
        left join public.reservation_management_state m on m.reservation_id=r.id
        left join public.reservation_payment_schedules ps on ps.reservation_id=r.id
        left join public.campground_booking_rules br on br.campground_id=r.campground_id
        left join public.campsites cs on cs.accommodation_id=r.accommodation_id
        left join public.rental_cottages rc on rc.accommodation_id=r.accommodation_id
        left join public.reservation_check_ins ci on ci.reservation_id=r.id
        left join public.reservation_check_outs co on co.reservation_id=r.id
        left join public.reservation_confirmations conf on conf.reservation_id=r.id
        left join public.reservation_invoices inv on inv.reservation_id=r.id
        where r.id=$1
          and r.guest_user_id=$2
        limit 1
      `,
      [reservationId, userId],
    );

    if (result.rowCount !== 1) return null;
    const row = result.rows[0];

    const receipts = await client.query(
      `
        select
          id,
          receipt_number,
          payment_purpose,
          currency_code,
          amount_cents,
          issued_at
        from public.reservation_receipts
        where reservation_id=$1
          and guest_user_id=$2
        order by issued_at desc,id
      `,
      [reservationId, userId],
    );

    const settings = ["confirmed", "checked_in"].includes(row.status)
      ? await guestSettings(client, userId, row.campground_id)
      : mapSettings(null);

    return {
      reservation: {
        id: row.id,
        status: row.status,
        phase: myStayPhase({
          status: row.status,
          arrivalDate: dateText(row.arrival_date),
          departureDate: dateText(row.departure_date),
          localDate: row.campground_local_date,
        }),
        rowVersion: Number(row.row_version),
        arrivalDate: dateText(row.arrival_date),
        departureDate: dateText(row.departure_date),
        campgroundLocalDate: row.campground_local_date,
        campground: {
          id: row.campground_id,
          name: row.campground_name,
          slug: row.campground_slug,
          timezone: row.campground_timezone,
        },
        accommodation: {
          id: row.accommodation_id,
          code: row.accommodation_code,
          displayName: row.accommodation_name,
          kind: row.accommodation_kind,
          statusState: row.accommodation_status_state,
          mapObjectId: row.map_object_id ?? null,
        },
      },
      contact: row.primary_first_name
        ? {
            name: [row.primary_first_name, row.primary_last_name]
              .filter(Boolean)
              .join(" "),
            email: row.contact_email,
            phone: row.contact_phone,
          }
        : null,
      party: {
        occupants: Number(
          row.verified_occupant_count ?? row.occupant_count ?? 0,
        ),
        visitors: Number(row.verified_visitor_count ?? row.visitor_count ?? 0),
        pets: Number(row.verified_pet_count ?? row.pet_count ?? 0),
        vehicles: Number(row.verified_vehicle_count ?? row.vehicle_count ?? 0),
      },
      rules: {
        currentCheckInTime: timeText(row.check_in_time),
        currentCheckOutTime: timeText(row.check_out_time),
        bookingSnapshot: row.booking_rules_snapshot ?? null,
        bookingAcknowledgedAt: iso(row.booking_rules_acknowledged_at),
        checkInAcknowledgedAt: iso(row.check_in_rules_acknowledged_at),
        guestSummary: settings.guestRulesSummary,
      },
      wifi: {
        service: row.wifi_service ?? null,
        networkName: settings.wifiNetworkName,
        accessInstructions: settings.wifiAccessInstructions,
      },
      campsite: row.campsite_type
        ? {
            campsiteType: row.campsite_type,
            serviceLevel: row.service_level,
            isWaterfront: row.is_waterfront === true,
            electricalAmperage: Number(row.electrical_amperage ?? 0),
            waterService: row.water_service,
            wastewaterService: row.wastewater_service,
            surfaceType: row.surface_type,
            pullThrough: row.pull_through === true,
            shadeLevel: row.shade_level,
            hasFireRing: row.has_fire_ring === true,
            hasPicnicTable: row.has_picnic_table === true,
          }
        : null,
      cottage: row.cottage_style
        ? {
            cottageStyle: row.cottage_style,
            bedroomCount: Number(row.bedroom_count ?? 0),
            bedCount: Number(row.bed_count ?? 0),
            maxOccupancy: Number(row.cottage_max_occupancy ?? 0),
            kitchenType: row.kitchen_type,
            washroomType: row.washroom_type,
            showerType: row.shower_type,
            heatingType: row.heating_type,
            coolingType: row.cooling_type,
            hasRefrigerator: row.has_refrigerator === true,
            hasCooktop: row.has_cooktop === true,
            hasOven: row.has_oven === true,
            hasMicrowave: row.has_microwave === true,
            stepFreeAccess: row.step_free_access === true,
            accessibleWashroom: row.accessible_washroom === true,
            viewType: row.view_type,
          }
        : null,
      payment: {
        ...moneyProgress(row),
        financialReviewRequired: row.financial_review_required === true,
        financialReviewReason: row.financial_review_reason ?? null,
      },
      checkIn: row.check_in_id
        ? {
            id: row.check_in_id,
            checkedInAt: iso(row.checked_in_at),
            credentialHandoffState: row.credential_handoff_state,
          }
        : null,
      checkOut: row.check_out_id
        ? {
            id: row.check_out_id,
            checkedOutAt: iso(row.checked_out_at),
            financialHandoffState: row.financial_handoff_state,
            outstandingBalanceCents: Number(
              row.check_out_outstanding_balance_cents ?? 0,
            ),
            rentalReturnState: row.rental_return_state,
            keyReturnState: row.key_return_state,
            credentialReturnState: row.credential_return_state,
            turnoverState: row.turnover_state,
          }
        : null,
      documents: {
        confirmationNumber: row.confirmation_number ?? null,
        invoiceNumber: row.invoice_number ?? null,
        receipts: receipts.rows.map((receipt) => ({
          id: receipt.id,
          receiptNumber: receipt.receipt_number,
          paymentPurpose: receipt.payment_purpose,
          currencyCode: receipt.currency_code,
          amountCents: Number(receipt.amount_cents),
          issuedAt: iso(receipt.issued_at),
        })),
      },
      portal: settings,
    };
  } finally {
    client.release();
  }
}

export async function getMyStaySettingsForStaff({ userId, campgroundId }) {
  await assertConfiguration(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const campground = await client.query(
      `
        select id,organization_id,name,slug
        from public.campgrounds
        where id=$1 and lifecycle_state <> 'archived'
        limit 1
      `,
      [campgroundId],
    );
    if (campground.rowCount !== 1) {
      throw new Error("Campground is unavailable.");
    }
    const settings = await client.query(
      `
        select *
        from public.campground_my_stay_settings
        where campground_id=$1
        limit 1
      `,
      [campgroundId],
    );
    await client.query("commit");
    return {
      campground: {
        id: campground.rows[0].id,
        organizationId: campground.rows[0].organization_id,
        name: campground.rows[0].name,
        slug: campground.rows[0].slug,
      },
      settings: mapSettings(settings.rows[0]),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveMyStaySettings({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  expectedRowVersion,
  input,
}) {
  await assertConfiguration(actorUserId, campgroundId);
  const normalized = normalizeMyStaySettingsInput(input);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 0) {
    throw new Error("My Stay settings row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const campground = await client.query(
      `
        select id,organization_id,name
        from public.campgrounds
        where id=$1 and lifecycle_state <> 'archived'
        limit 1
      `,
      [campgroundId],
    );
    if (campground.rowCount !== 1) {
      throw new Error("Campground is unavailable.");
    }

    const current = await client.query(
      `
        select *
        from public.campground_my_stay_settings
        where campground_id=$1
        for update
      `,
      [campgroundId],
    );
    const before = current.rows[0] ?? null;
    let saved;

    if (before) {
      if (Number(before.row_version) !== expected) {
        throw new Error(
          "My Stay settings changed since this page loaded. Refresh and try again.",
        );
      }
      const updated = await client.query(
        `
          update public.campground_my_stay_settings
          set guest_rules_summary=$3,
              wifi_network_name=$4,
              wifi_access_instructions=$5,
              assistance_instructions=$6,
              store_url=$7,
              rentals_url=$8,
              events_url=$9,
              local_interests_url=$10,
              assistance_url=$11,
              updated_by_user_id=$12
          where campground_id=$1
            and organization_id=$2
            and row_version=$13
          returning *
        `,
        [
          campgroundId,
          campground.rows[0].organization_id,
          normalized.guestRulesSummary,
          normalized.wifiNetworkName,
          normalized.wifiAccessInstructions,
          normalized.assistanceInstructions,
          normalized.storeUrl,
          normalized.rentalsUrl,
          normalized.eventsUrl,
          normalized.localInterestsUrl,
          normalized.assistanceUrl,
          actorUserId,
          expected,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error(
          "My Stay settings changed since this page loaded. Refresh and try again.",
        );
      }
      saved = updated.rows[0];
    } else {
      if (expected !== 0) {
        throw new Error(
          "My Stay settings changed since this page loaded. Refresh and try again.",
        );
      }
      const inserted = await client.query(
        `
          insert into public.campground_my_stay_settings (
            organization_id,
            campground_id,
            guest_rules_summary,
            wifi_network_name,
            wifi_access_instructions,
            assistance_instructions,
            store_url,
            rentals_url,
            events_url,
            local_interests_url,
            assistance_url,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
          returning *
        `,
        [
          campground.rows[0].organization_id,
          campgroundId,
          normalized.guestRulesSummary,
          normalized.wifiNetworkName,
          normalized.wifiAccessInstructions,
          normalized.assistanceInstructions,
          normalized.storeUrl,
          normalized.rentalsUrl,
          normalized.eventsUrl,
          normalized.localInterestsUrl,
          normalized.assistanceUrl,
          actorUserId,
        ],
      );
      saved = inserted.rows[0];
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.rows[0].organization_id,
      campgroundId,
      actionKey: "campground.my_stay.settings.save",
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground.my_stay_settings",
      subjectId: campgroundId,
      beforeState: before ? mapSettings(before) : null,
      afterState: mapSettings(saved),
    });

    await client.query("commit");
    return mapSettings(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
