import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { summary283 } from "@/lib/build283/postgres.mjs";
import { closeRecovery283Action } from "./actions";

export const dynamic = "force-dynamic";

export default async function Acceptance283Page({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireSysop("/sysop");
  const [state, params] = await Promise.all([summary283(), searchParams]);
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs">
          <Link href="/sysop">Rosevear Admin Shell</Link>
          <span>/</span>
          <span>Build 283 recovery monitoring</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <h1>Independent delivery monitoring and incident closure</h1>
          <p>
            Scheduled submission is not provider delivery. Closure requires a
            genuine signed delivery, fresh original recovery evidence and a
            separate authorized reviewer.
          </p>
        </section>
        <section className="content-panel">
          <h2>
            {state.ready ? "Original schema present" : "Original schema HOLD"}
          </h2>
          <p>
            Last recorded monitor:{" "}
            {state.latest
              ? String(state.latest.sampled_at) +
                " · " +
                state.latest.evidence_status
              : "No original scheduled sample"}
          </p>
          <p>
            A past sample is not current health. Automatic retry is bounded to
            three attempts, separated by at least one hour, for previously
            opened incidents.
          </p>
          <Link href="/sysop/acceptance282">Original incident and delivery evidence</Link>
          <ul>
            {state.incidents.map((incident) => (
              <li key={incident.id}>
                <code>{incident.id}</code> · {incident.reason} ·{" "}
                {incident.attempts}/3 attempts ·{" "}
                {incident.receipt_present ? "Receipt recorded" : "Delivery HOLD"}{" "}
                · {incident.closure_recorded ? "Closure recorded" : "Open"}
              </li>
            ))}
          </ul>
          {params.result === "hold" && <p>HOLD — independent evidence missing.</p>}
          {params.result === "recorded" && <p>Historical recovery closure recorded.</p>}
          <form action={closeRecovery283Action}>
            <label>
              Original recovery incident ID
              <input name="id" required maxLength={36} />
            </label>
            <button disabled={!state.ready}>Independently review recovery closure</button>
          </form>
        </section>
      </div>
    </SysopShell>
  );
}
