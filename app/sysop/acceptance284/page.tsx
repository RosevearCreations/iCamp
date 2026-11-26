import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { summary284 } from "@/lib/build284/postgres.mjs";

export const dynamic = "force-dynamic";

export default async function Acceptance284Page() {
  await requireSysop("/sysop");
  const state = await summary284();
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <h1>Independent scheduler and recovery discovery</h1>
          <p>
            Historical observations never certify current recovery. Discoveries
            require authorized incident review before external escalation.
          </p>
        </section>
        <section className="content-panel">
          <h2>{state.ready ? "Original schema present" : "Original schema HOLD"}</h2>
          <p>
            Latest authenticated scheduler observation:{" "}
            {state.latest ? String(state.latest.sampled_at) : "HOLD"}
          </p>
          <p>
            Observed recovery: {state.latest?.evidence_status ?? "HOLD"}
          </p>
          <p>
            Historical delivery checks:{" "}
            {state.latest
              ? state.latest.delivery_verified + "/" + state.latest.delivery_checked
              : "HOLD"}
          </p>
          <Link href="/sysop/acceptance282">Review and open original incidents</Link>
          <ul>
            {state.discoveries.map((item) => (
              <li key={item.id}>
                {item.reason} · <code>{item.ack_id}</code> ·{" "}
                {item.opened ? "Incident opened" : "Operator review required"}
              </li>
            ))}
          </ul>
          <Link href="/sysop/acceptance283">Independent closure review</Link>
        </section>
      </div>
    </SysopShell>
  );
}
