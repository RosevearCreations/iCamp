"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createAccommodation,
  updateAccommodation,
  updateCampsiteDetails,
  updateRentalCottageDetails,
} from "@/lib/accommodations/postgres.mjs";
import {
  addCottageInventoryChecklistItem,
  createCottageHousekeepingTemplate,
  createCottageTurnover,
  recordCottageDamageInspection,
  recordCottageTurnoverItemCheck,
} from "@/lib/housekeeping/postgres.mjs";

const path = "/workspaces/management/campgrounds/accommodations";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string) {
  return formData.has(key);
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}

export async function createAccommodationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await createAccommodation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    sectionId: field(formData, "sectionId"),
    subsectionId: field(formData, "subsectionId") || null,
    kind: field(formData, "kind"),
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
  });

  finish(campgroundId, "Accommodation created.");
}

export async function updateAccommodationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await updateAccommodation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    sectionId: field(formData, "sectionId"),
    subsectionId: field(formData, "subsectionId") || null,
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
    lifecycleState: field(formData, "lifecycleState"),
  });

  finish(campgroundId, "Accommodation saved.");
}

export async function updateCampsiteDetailsAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await updateCampsiteDetails({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    expectedDetailRowVersion: Number(field(formData, "detailRowVersion")),
    campsiteType: field(formData, "campsiteType"),
    serviceLevel: field(formData, "serviceLevel"),
    stayProfile: field(formData, "stayProfile"),
    isWaterfront: checked(formData, "isWaterfront"),
    electricalAmperage: Number(field(formData, "electricalAmperage")),
    waterService: field(formData, "waterService"),
    wastewaterService: field(formData, "wastewaterService"),
    wifiService: field(formData, "wifiService"),
    siteLengthMeters: field(formData, "siteLengthMeters") || null,
    siteWidthMeters: field(formData, "siteWidthMeters") || null,
    maxRvLengthMeters: field(formData, "maxRvLengthMeters") || null,
    maxRvWidthMeters: field(formData, "maxRvWidthMeters") || null,
    maxRvHeightMeters: field(formData, "maxRvHeightMeters") || null,
    surfaceType: field(formData, "surfaceType"),
    pullThrough: checked(formData, "pullThrough"),
    shadeLevel: field(formData, "shadeLevel"),
    hasFireRing: checked(formData, "hasFireRing"),
    hasPicnicTable: checked(formData, "hasPicnicTable"),
  });

  finish(campgroundId, "Campsite details saved.");
}

export async function updateRentalCottageDetailsAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await updateRentalCottageDetails({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    expectedDetailRowVersion: Number(field(formData, "detailRowVersion")),
    cottageStyle: field(formData, "cottageStyle"),
    bedroomCount: field(formData, "bedroomCount"),
    bedCount: field(formData, "bedCount"),
    maxOccupancy: field(formData, "maxOccupancy"),
    kitchenType: field(formData, "kitchenType"),
    washroomType: field(formData, "washroomType"),
    showerType: field(formData, "showerType"),
    heatingType: field(formData, "heatingType"),
    coolingType: field(formData, "coolingType"),
    hasRefrigerator: checked(formData, "hasRefrigerator"),
    hasCooktop: checked(formData, "hasCooktop"),
    hasOven: checked(formData, "hasOven"),
    hasMicrowave: checked(formData, "hasMicrowave"),
    stepFreeAccess: checked(formData, "stepFreeAccess"),
    accessibleWashroom: checked(formData, "accessibleWashroom"),
    viewType: field(formData, "viewType"),
  });

  finish(campgroundId, "Rental cottage details saved.");
}

export async function createCottageHousekeepingTemplateAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await createCottageHousekeepingTemplate({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    name: field(formData, "name"),
    turnoverType: field(formData, "turnoverType"),
    expectedMinutes: field(formData, "expectedMinutes"),
    linenRequirements: field(formData, "linenRequirements"),
    housekeepingRequirements: field(formData, "housekeepingRequirements"),
    damageInspectionRequired: checked(formData, "damageInspectionRequired"),
    securityInspectionRequired: checked(formData, "securityInspectionRequired"),
  });

  finish(campgroundId, "Cottage turnover template created.");
}

export async function addCottageInventoryChecklistItemAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await addCottageInventoryChecklistItem({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    templateId: field(formData, "templateId"),
    category: field(formData, "category"),
    name: field(formData, "name"),
    requiredQuantity: field(formData, "requiredQuantity"),
    unit: field(formData, "unit"),
    expectedCondition: field(formData, "expectedCondition"),
    sortOrder: field(formData, "sortOrder"),
    isRequired: checked(formData, "isRequired"),
  });

  finish(campgroundId, "Cottage inventory checklist item added.");
}

export async function createCottageTurnoverAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await createCottageTurnover({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    templateId: field(formData, "templateId"),
    notes: field(formData, "notes"),
  });

  finish(campgroundId, "Cottage turnover started.");
}

export async function recordCottageTurnoverItemCheckAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await recordCottageTurnoverItemCheck({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    turnoverId: field(formData, "turnoverId"),
    checkId: field(formData, "checkId"),
    issueFound: checked(formData, "issueFound"),
    notes: field(formData, "notes"),
  });

  finish(campgroundId, "Turnover checklist evidence saved.");
}

export async function recordCottageDamageInspectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await recordCottageDamageInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    turnoverId: field(formData, "turnoverId"),
    linenComplete: checked(formData, "linenComplete"),
    housekeepingComplete: checked(formData, "housekeepingComplete"),
    damageFound: checked(formData, "damageFound"),
    securityIssueFound: checked(formData, "securityIssueFound"),
    damageNotes: field(formData, "damageNotes"),
    securityNotes: field(formData, "securityNotes"),
  });

  finish(campgroundId, "Cottage readiness inspection recorded.");
}
