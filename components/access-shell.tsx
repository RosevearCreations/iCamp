import Link from "next/link";
import { EnvironmentBanner } from "@/components/environment-banner";
import { StandardAccessibilityControls } from "@/components/standard-accessibility-controls";

export function AccessShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="app-shell"
      data-theme="standard"
      data-visual="orbit"
      data-shell="platform-access"
    >
      <EnvironmentBanner />
      <header className="topbar">
        <Link className="brand" href="/auth/login?next=%2Fsysop">
          <span className="brand__mark" aria-hidden="true">
            SO
          </span>
          <span>
            <strong>iCamp — Platform access</strong>
            <small>Administrator sign-in · not campground operations</small>
          </span>
        </Link>
        <StandardAccessibilityControls />
        <Link href="/auth/login?next=%2Fcampground">Campground sign-in</Link>
      </header>
      <main className="main-content" id="main-content">
        {children}
      </main>
    </div>
  );
}
