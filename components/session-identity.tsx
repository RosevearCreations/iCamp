"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { workspaceKind288 } from "@/lib/build288/workspace.mjs";

type Identity = {
  signedIn?: boolean;
  unavailable?: boolean;
  username?: string;
  accountType?: string;
  assurance?: string;
  platform?: boolean;
  assigned?: { id: string; name: string; roles: string[] }[] | null;
};

export function SessionIdentity({
  platform = false,
  access = false,
}: Readonly<{ platform?: boolean; access?: boolean }>) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<{
    path: string;
    value: Identity;
  } | null>(null);
  const identity = snapshot?.path === pathname ? snapshot.value : null;
  const guest = workspaceKind288(pathname) === "guest";
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
        {access
          ? "Platform access · authentication"
          : platform
            ? "Platform administrator shell"
            : guest
              ? "Camper / guest portal"
              : "Campground application"}
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
            {platform || access
              ? "Tenant: not applicable"
              : identity.accountType === "guest"
                ? "Campground: see your selected stay"
                : identity.assigned === null
                  ? "Campground assignment unavailable"
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
          <details>
            <summary>Switch account (sign out first)</summary>
            <form action="/api/auth/logout?switchTo=platform" method="post">
              <button type="submit">Administrator sign-in</button>
            </form>
            <form action="/api/auth/logout?switchTo=campground" method="post">
              <button type="submit">Campground sign-in</button>
            </form>
            <form action="/api/auth/logout?switchTo=guest" method="post">
              <button type="submit">Guest sign-in</button>
            </form>
          </details>
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
