import type { MyStaySettingsInput } from "./core.mjs";

export interface MyStayListItem {
  id: string;
  status: string;
  phase: string;
  arrivalDate: string;
  departureDate: string;
  campgroundLocalDate: string;
  campgroundName: string;
  campgroundSlug: string;
  accommodationCode: string;
  accommodationName: string;
  accommodationKind: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

export function closeMyStayPoolForTests(): Promise<void>;

export function listMyStays(input: {
  userId: string;
}): Promise<MyStayListItem[]>;

export function getMyStayDetail(input: {
  userId: string;
  reservationId: string;
}): Promise<any | null>;

export function getMyStaySettingsForStaff(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  campground: {
    id: string;
    organizationId: string;
    name: string;
    slug: string;
  };
  settings: MyStaySettingsInput & {
    persisted: boolean;
    rowVersion: number;
  };
}>;

export function saveMyStaySettings(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  expectedRowVersion: number;
  input: Record<string, unknown>;
}): Promise<
  MyStaySettingsInput & {
    persisted: boolean;
    rowVersion: number;
  }
>;
