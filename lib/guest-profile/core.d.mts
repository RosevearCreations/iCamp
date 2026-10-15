export type GuestSourceChannel =
  | "web"
  | "staff"
  | "ivr"
  | "sms"
  | "import"
  | "system";

export function normalizeGuestSourceChannel(value?: unknown): GuestSourceChannel;

export function normalizeGuestProfileInput(
  input?: Record<string, unknown>,
): {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  preferredContactChannel: "email" | "sms" | "phone" | "none";
  saveStayPreferences: boolean;
  allowStaffProfileLookup: boolean;
};

export function normalizeGuestRvInput(input?: Record<string, unknown>): {
  nickname: string;
  rvKind:
    | "motorhome"
    | "travel_trailer"
    | "fifth_wheel"
    | "pop_up"
    | "truck_camper"
    | "other";
  make: string | null;
  model: string | null;
  modelYear: number | null;
  lengthFeet: number | null;
  slideOutCount: number;
  electricalServiceAmps: number | null;
  notes: string | null;
};

export function normalizeGuestVehicleInput(input?: Record<string, unknown>): {
  nickname: string;
  vehicleKind:
    | "car"
    | "truck"
    | "suv"
    | "van"
    | "motorcycle"
    | "tow_vehicle"
    | "other";
  make: string | null;
  model: string | null;
  color: string | null;
  modelYear: number | null;
  notes: string | null;
};

export function normalizeGuestPetInput(input?: Record<string, unknown>): {
  name: string;
  species: "dog" | "cat" | "bird" | "other";
  breed: string | null;
  weightKg: number | null;
  notes: string | null;
};

export function normalizeSavedItemKind(value: unknown): "rv" | "vehicle" | "pet";
