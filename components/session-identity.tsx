"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Identity = {
  signedIn?: boolean;
  unavailable?: boolean;
  username?: string;
  accountType?: string;
  assurance?: string;
  platform?: boolean;
  assigned?: { id: string; name: string; roles: string[] }[];
};

export function SessionIdentity({
  platform = false,
}: Readonly<{ platform?: boolean }>) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<{
    path: string;
    value: Identity;
  } | null>(null);
  const identity = snapshot?.path === pathname ? snapshot.value : null;
  useEffect(() => {
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch("/api/auth/session-identity", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const value = response.ok
          ? await response.json()
          : { unavailable: true };
        if (active) setSnapshot({ path: pathname, value });
      } catch {
        if (active)
          setSnapshot({ path: pathname, value: { unavailable: true } });
      } finally {
        pending = false;
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [pathname]);
  const selected = identity?.assigned?.find(
    (item) =>
      item.id ===
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      ).get("campground"),
  );
  return (
    <div className="account-context286" aria-label="Account and workspace">
      <strong>
        {platform ? "Platform administrator shell" : "Campground application"}
      </strong>
      {identity?.signedIn ? (
        <>
          <span>
            Signed in: {identity.username} ·{" "}
            {identity.platform
              ? "Verified platform operator"
              : identity.accountType}{" "}
            ·{" "}
            {identity.assurance === "aal2"
              ? "MFA verified"
              : "Password session"}
          </span>
          <span>
            {platform
              ? "Tenant: not applicable"
              : selected
                ? selected.name + " · " + selected.roles.join(", ")
                : identity.assigned?.length
                  ? "Assigned: " +
                    identity.assigned.map((item) => item.name).join(", ")
                  : "No staff campground assignment"}
          </span>
          <Link href="/auth/account">My account</Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit">Sign out</button>
          </form>
        </>
      ) : (
        <>
          <span>
            {identity?.unavailable
              ? "Account status unavailable"
              : identity
                ? "Not signed in"
                : "Checking session…"}
          </span>
          <Link href="/auth/login?next=%2Fcampground">Campground sign-in</Link>
          <Link href="/auth/login?next=%2Fsysop">Administrator sign-in</Link>
        </>
      )}
    </div>
  );
}
