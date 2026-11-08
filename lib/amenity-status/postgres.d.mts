import type {
  AmenityPublication,
  AmenityStatusAsset,
  AmenityStatusWorkOrder,
} from "./board.mjs";
export function listPublishedAmenityStatusForStaff(
  userId: string,
  campgroundId: string,
): Promise<{
  migrationReady: boolean;
  publications: AmenityPublication[];
}>;
export function closeAmenityStatusPoolForTests(): Promise<void>;
export function listStaffAmenityAssets(
  userId: string,
  campgroundId: string,
): Promise<AmenityStatusAsset[]>;
export function listActiveAmenityWorkOrderSummaries(
  userId: string,
  campgroundId: string,
): Promise<AmenityStatusWorkOrder[]>;
