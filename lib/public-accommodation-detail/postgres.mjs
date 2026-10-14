import pg from "pg";

import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "../media/storage.mjs";
import { formatMoney, quoteAccommodationStay } from "../pricing/core.mjs";
import { publicBookingMapPresentation } from "../public-booking-map/core.mjs";
import {
  humanizePublicFact,
  normalizePublicAccommodationDates,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is required for public accommodation detail.",
      );
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

export async function closePublicAccommodationDetailPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

function mediaPublicUrl(row) {
  if (!row?.storage_provider || row.storage_provider !== "supabase")
    return null;
  const config = getMediaStorageConfig();
  if (!config.projectUrl) return null;
  return createSupabaseStorageAdapter({
    projectUrl: config.projectUrl,
    secretKey: config.secretKey,
  }).getPublicUrl({
    bucketKey: row.bucket_key,
    objectKey: row.object_key,
  });
}

function boolFact(label, value) {
  return { label, value: value ? "Yes" : "No" };
}

function campsiteFacts(row) {
  const facts = [
    { label: "Site type", value: humanizePublicFact(row.campsite_type) },
    { label: "Service level", value: humanizePublicFact(row.service_level) },
    { label: "Stay profile", value: humanizePublicFact(row.stay_profile) },
    {
      label: "Electrical",
      value: row.electrical_amperage
        ? `${row.electrical_amperage} amp`
        : "None",
    },
    { label: "Water", value: humanizePublicFact(row.water_service) },
    { label: "Wastewater", value: humanizePublicFact(row.wastewater_service) },
    { label: "Wi-Fi", value: humanizePublicFact(row.wifi_service) },
    { label: "Surface", value: humanizePublicFact(row.surface_type) },
    { label: "Shade", value: humanizePublicFact(row.shade_level) },
    boolFact("Waterfront", row.is_waterfront),
    boolFact("Pull-through", row.pull_through),
    boolFact("Accessible site", row.accessible_site),
    boolFact("Fire ring", row.has_fire_ring),
    boolFact("Picnic table", row.has_picnic_table),
  ];

  if (row.site_length_meters && row.site_width_meters) {
    facts.push({
      label: "Site size",
      value: `${row.site_length_meters} m × ${row.site_width_meters} m`,
    });
  }
  if (row.max_rv_length_meters) {
    facts.push({
      label: "Maximum RV length",
      value: `${row.max_rv_length_meters} m`,
    });
  }

  return facts;
}

function cottageFacts(row) {
  return [
    { label: "Cottage style", value: humanizePublicFact(row.cottage_style) },
    { label: "Bedrooms", value: String(row.bedroom_count) },
    { label: "Beds", value: String(row.bed_count) },
    { label: "Maximum sleeping occupancy", value: String(row.max_occupancy) },
    { label: "Kitchen", value: humanizePublicFact(row.kitchen_type) },
    { label: "Washroom", value: humanizePublicFact(row.washroom_type) },
    { label: "Shower", value: humanizePublicFact(row.shower_type) },
    { label: "Heating", value: humanizePublicFact(row.heating_type) },
    { label: "Cooling", value: humanizePublicFact(row.cooling_type) },
    { label: "View", value: humanizePublicFact(row.view_type) },
    boolFact("Refrigerator", row.has_refrigerator),
    boolFact("Cooktop", row.has_cooktop),
    boolFact("Oven", row.has_oven),
    boolFact("Microwave", row.has_microwave),
    boolFact("Step-free access", row.step_free_access),
    boolFact("Accessible washroom", row.accessible_washroom),
  ];
}

function ruleSummary(row, bookingRules) {
  const rules = [
    {
      label: "Pets",
      value: row.pets_allowed
        ? `Allowed · up to ${row.max_pets} ${Number(row.max_pets) === 1 ? "pet" : "pets"}`
        : "Not allowed",
    },
  ];

  if (bookingRules) {
    rules.push(
      {
        label: "Check-in",
        value: String(bookingRules.check_in_time).slice(0, 5),
      },
      {
        label: "Check-out",
        value: String(bookingRules.check_out_time).slice(0, 5),
      },
      {
        label: "Stay length",
        value: `${bookingRules.minimum_stay_nights}–${bookingRules.maximum_stay_nights} nights`,
      },
      {
        label: "Advance booking window",
        value: `${bookingRules.minimum_booking_lead_days}–${bookingRules.maximum_booking_lead_days} days ahead`,
      },
    );
  }

  return rules;
}

export async function getPublicAccommodationDetail(input) {
  const { arrivalDate, departureDate, nights } =
    normalizePublicAccommodationDates(input);
  const campgroundSlug = String(input.campgroundSlug ?? "").trim();
  const accommodationId = String(input.accommodationId ?? "").trim();
  if (!campgroundSlug || !accommodationId) return null;

  const client = await getPool().connect();
  try {
    const campgroundResult = await client.query(
      `select id, name, slug
       from public.campgrounds
       where slug = $1 and lifecycle_state = 'active'
       limit 1`,
      [campgroundSlug],
    );
    if (campgroundResult.rowCount !== 1) return null;
    const campground = campgroundResult.rows[0];

    const mapResult = await client.query(
      `select id, version_number
       from icamp_private.campground_map_image_versions
       where campground_id = $1 and is_published
       limit 1`,
      [campground.id],
    );
    if (mapResult.rowCount !== 1) return null;
    const map = mapResult.rows[0];

    const detailResult = await client.query(
      `select
         a.id,
         a.code,
         a.display_name,
         a.accommodation_kind,
         a.status_state,
         a.section_id,
         s.name as section_name,
         cs.campsite_type,
         cs.service_level,
         cs.stay_profile,
         cs.is_waterfront,
         cs.electrical_amperage,
         cs.water_service,
         cs.wastewater_service,
         cs.wifi_service,
         cs.site_length_meters,
         cs.site_width_meters,
         cs.max_rv_length_meters,
         cs.surface_type,
         cs.pull_through,
         cs.shade_level,
         cs.has_fire_ring,
         cs.has_picnic_table,
         cs.accessible_site,
         cs.pets_allowed as campsite_pets_allowed,
         cs.max_pets as campsite_max_pets,
         rc.cottage_style,
         rc.bedroom_count,
         rc.bed_count,
         rc.max_occupancy,
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
         rc.pets_allowed as cottage_pets_allowed,
         rc.max_pets as cottage_max_pets,
         av.reservation_blocked,
         av.hold_blocked,
         av.restriction_blocked,
         av.turnover_blocked,
         av.seasonal_blocked
       from public.accommodations a
       join icamp_private.campground_map_object_bindings b
         on b.map_object_id = a.map_object_id
        and b.campground_id = a.campground_id
        and b.map_image_version_id = $5
       left join public.campground_sections s
         on s.id = a.section_id
        and s.campground_id = a.campground_id
       left join public.campsites cs
         on cs.accommodation_id = a.id
        and cs.campground_id = a.campground_id
       left join public.rental_cottages rc
         on rc.accommodation_id = a.id
        and rc.campground_id = a.campground_id
       join icamp_private.live_accommodation_availability($1, $3, $4) av
         on av.accommodation_id = a.id
       where a.campground_id = $1
         and a.id = $2
         and a.lifecycle_state = 'active'
         and a.accommodation_kind in ('campsite', 'rental_cottage')
       limit 1`,
      [campground.id, accommodationId, arrivalDate, departureDate, map.id],
    );
    if (detailResult.rowCount !== 1) return null;

    const row = detailResult.rows[0];
    row.pets_allowed =
      row.accommodation_kind === "campsite"
        ? row.campsite_pets_allowed
        : row.cottage_pets_allowed;
    row.max_pets =
      row.accommodation_kind === "campsite"
        ? row.campsite_max_pets
        : row.cottage_max_pets;

    const blockers = [];
    if (row.reservation_blocked) blockers.push("reservation");
    if (row.hold_blocked) blockers.push("temporary_hold");
    if (row.restriction_blocked) blockers.push("management_restriction");
    if (row.turnover_blocked) blockers.push("turnover");
    if (row.seasonal_blocked) blockers.push("seasonal_assignment");
    const availability = publicBookingMapPresentation({
      statusState: row.status_state,
      blockers,
    });

    const [
      galleryResult,
      amenitiesResult,
      bookingRulesResult,
      ratePlansResult,
      rateRulesResult,
      pricingPeriodsResult,
    ] = await Promise.all([
      client.query(
          `select
           g.id,
           g.caption,
           g.alt_text,
           g.sort_order,
           g.is_hero,
           m.storage_provider,
           m.bucket_key,
           m.object_key
         from public.accommodation_public_gallery_images g
         join icamp_private.media_assets m
           on m.id = g.optimized_media_asset_id
          and m.classification = 'public'
          and m.lifecycle_state = 'active'
         where g.campground_id = $1
           and g.accommodation_id = $2
           and g.is_active
         order by g.is_hero desc, g.sort_order, g.created_at
         limit 10`,
          [campground.id, accommodationId],
      ),
      client.query(
          `select
           o.object_code,
           o.display_name,
           o.object_kind,
           sec.name as section_name,
           (o.section_id is not distinct from $3) as same_section
         from icamp_private.campground_map_objects o
         join icamp_private.campground_map_object_bindings b
           on b.map_object_id = o.id
          and b.map_image_version_id = $2
         join icamp_private.campground_map_layers l
           on l.id = b.layer_id
          and l.campground_id = o.campground_id
         left join public.campground_sections sec
           on sec.id = o.section_id
          and sec.campground_id = o.campground_id
         where o.campground_id = $1
           and o.lifecycle_state = 'active'
           and l.layer_key = 'amenities'
         order by same_section desc, o.display_name, o.object_code
         limit 8`,
          [campground.id, map.id, row.section_id],
      ),
      client.query(
          `select
           check_in_time,
           check_out_time,
           minimum_booking_lead_days,
           maximum_booking_lead_days,
           minimum_stay_nights,
           maximum_stay_nights,
           weekend_iso_days
         from public.campground_booking_rules
         where campground_id = $1
         limit 1`,
          [campground.id],
      ),
      client.query(
          `select *
           from public.rate_plans
           where campground_id = $1
             and is_active
             and starts_on <= $4::date
             and ends_on >= $3::date
             and (
               accommodation_id = $2
               or (accommodation_id is null and accommodation_kind = $5)
             )
           order by (accommodation_id is not null) desc, priority, code`,
          [
            campground.id,
            accommodationId,
            arrivalDate,
            departureDate,
            row.accommodation_kind,
          ],
      ),
      client.query(
          `select rr.*
           from public.rate_rules rr
           join public.rate_plans rp on rp.id = rr.rate_plan_id
           where rr.campground_id = $1
             and rr.is_active
             and rp.is_active
             and (
               rp.accommodation_id = $2
               or (rp.accommodation_id is null and rp.accommodation_kind = $3)
             )
           order by rr.priority, rr.code`,
          [campground.id, accommodationId, row.accommodation_kind],
      ),
      client.query(
          `select id, period_kind, code, display_name, starts_on, ends_on, is_active
           from public.booking_calendar_periods
           where campground_id = $1 and is_active
           order by starts_on, code`,
          [campground.id],
        ),
      ]);

    const pricingQuote = quoteAccommodationStay({
      plans: ratePlansResult.rows.map((plan) => ({
        id: plan.id,
        accommodationId: plan.accommodation_id,
        accommodationKind: plan.accommodation_kind,
        code: plan.code,
        displayName: plan.display_name,
        currencyCode: plan.currency_code,
        nightlyCents: plan.nightly_cents,
        weeklyCents: plan.weekly_cents,
        monthlyCents: plan.monthly_cents,
        seasonalCents: plan.seasonal_cents,
        yearlyCents: plan.yearly_cents,
        startsOn: String(plan.starts_on).slice(0, 10),
        endsOn: String(plan.ends_on).slice(0, 10),
        priority: plan.priority,
        isActive: plan.is_active,
      })),
      rules: rateRulesResult.rows.map((rule) => ({
        ratePlanId: rule.rate_plan_id,
        ruleKind: rule.rule_kind,
        calendarPeriodId: rule.calendar_period_id,
        code: rule.code,
        displayName: rule.display_name,
        startsOn: rule.starts_on ? String(rule.starts_on).slice(0, 10) : null,
        endsOn: rule.ends_on ? String(rule.ends_on).slice(0, 10) : null,
        adjustmentPercent: rule.adjustment_percent,
        adjustmentCents: rule.adjustment_cents,
        priority: rule.priority,
        isActive: rule.is_active,
      })),
      periods: pricingPeriodsResult.rows.map((period) => ({
        id: period.id,
        periodKind: period.period_kind,
        code: period.code,
        displayName: period.display_name,
        startsOn: String(period.starts_on).slice(0, 10),
        endsOn: String(period.ends_on).slice(0, 10),
        isActive: period.is_active,
      })),
      weekendIsoDays: (
        bookingRulesResult.rows[0]?.weekend_iso_days ?? [6, 7]
      ).map(Number),
      accommodationId,
      accommodationKind: row.accommodation_kind,
      arrivalDate,
      departureDate,
    });

    const rateSummary =
      pricingQuote.status === "quoted"
        ? {
            status: "quoted",
            label: "Dynamic date price",
            detail:
              formatMoney(pricingQuote.totalCents, pricingQuote.currencyCode) +
              " for " +
              nights +
              (nights === 1 ? " night" : " nights") +
              " · " +
              pricingQuote.plan.displayName,
            currencyCode: pricingQuote.currencyCode,
            totalCents: pricingQuote.totalCents,
            baseCents: pricingQuote.baseCents,
            adjustmentCents: pricingQuote.adjustmentCents,
            adjustments: pricingQuote.adjustments,
          }
        : {
            status: "rate_unavailable",
            label: "Rate unavailable",
            detail:
              "No active canonical rate plan covers this accommodation and date range.",
            currencyCode: null,
            totalCents: null,
            baseCents: null,
            adjustmentCents: null,
            adjustments: [],
          };

    const facts =
      row.accommodation_kind === "campsite"
        ? campsiteFacts(row)
        : cottageFacts(row);

    return {
      campground: {
        id: campground.id,
        name: campground.name,
        slug: campground.slug,
      },
      accommodation: {
        id: row.id,
        code: row.code,
        displayName: row.display_name,
        kind: row.accommodation_kind,
        sectionName: row.section_name ?? null,
      },
      dates: { arrivalDate, departureDate, nights },
      availability: {
        ...availability,
        blockers,
      },
      facts,
      rules: ruleSummary(row, bookingRulesResult.rows[0] ?? null),
      rateSummary,
      gallery: galleryResult.rows.map((image) => ({
        id: image.id,
        caption: image.caption,
        altText: image.alt_text,
        sortOrder: Number(image.sort_order),
        isHero: image.is_hero,
        url: mediaPublicUrl(image),
      })),
      mapContext: {
        versionNumber: Number(map.version_number),
        sectionName: row.section_name ?? null,
        nearbyAmenities: amenitiesResult.rows.map((amenity) => ({
          code: amenity.object_code,
          displayName: amenity.display_name,
          kind: amenity.object_kind,
          sectionName: amenity.section_name ?? null,
          sameSection: amenity.same_section === true,
        })),
      },
    };
  } finally {
    client.release();
  }
}
