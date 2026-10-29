export interface AccountProfile {
  display_name: string;
  preferred_contact: "none" | "email" | "phone";
}

export function getOwnAccountProfile(userId: string): Promise<AccountProfile>;
export function saveOwnAccountProfile(input: {
  userId: string;
  displayName: string;
  preferredContact: "none" | "email" | "phone";
}): Promise<void>;
