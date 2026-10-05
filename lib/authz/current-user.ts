import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import {
  hasAnyCampgroundPermission,
  hasCampgroundPermission,
} from "@/lib/authz/postgres.mjs";
import type { Permission } from "@/lib/authz/permissions";

export async function requireAnyCampgroundPermission(
  permission: Permission,
  returnPath = "/",
) {
  const session = await requireStaff(returnPath);
  const allowed = await hasAnyCampgroundPermission(
    session.user.id,
    permission,
  );

  if (!allowed) {
    redirect("/auth/not-authorized");
  }

  return session;
}

export async function requireCampgroundPermission(
  campgroundId: string,
  permission: Permission,
  returnPath = "/",
) {
  const session = await requireStaff(returnPath);
  const allowed = await hasCampgroundPermission(
    session.user.id,
    campgroundId,
    permission,
  );

  if (!allowed) {
    redirect("/auth/not-authorized");
  }

  return session;
}
