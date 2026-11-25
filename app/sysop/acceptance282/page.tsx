import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { summary282 } from "@/lib/build282/postgres.mjs";
import {
  dispatchRecovery282Action,
  openRecovery282Action,
  recordDelivery282Action,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function Acceptance282Page({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireSysop("/sysop");
  const [state, params] = await Promise.all([summary282(), searchParams]);
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs">
          <Link href="/sysop">Rosevear Admin Shell</Link>
          <span>/</span>
          <span>Build 282 recovery alerts</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <h1>Original provider alert and recovery escalation review</h1>
          <p>
            Historical signed evidence does not establish current availability.
            Delivery requires a genuine externally signed receipt and separate
            original operator review. Optional provider submission is not delivery.
          </p>
        </section>
        <section className="content-panel" aria-live="polite">
          <h2>
            {state.ready
              ? "Original schema present"
              : "HOLD — original schema or host unverified"}
          </h2>
          {params.result === "hold" && (
            <p>HOLD — evidence or review rejected.</p>
          )}
          {params.result === "opened" && (
            <p>Incident recorded; alert delivery remains HOLD.</p>
          )}
          {params.result === "reviewed" && (
            <p>
              Signed delivery receipt recorded; recovery remains independent.
            </p>
          )}
          <p>
            Current reasons:{" "}
            {state.reasons.join(", ") || "No current reasons displayed"}
          </p>
          <Link href="/sysop/acceptance281">Review live original evidence</Link>
          <h3>Historically verified restore receipts</h3>
          <ul>
            {state.history.map((item) => (
              <li key={item.id}>
                <code>{item.id}</code> · <code>{item.digest}</code>
              </li>
            ))}
          </ul>
          <form action={openRecovery282Action}>
            <label>
              Original signed restore acknowledgment ID
              <input name="ackId" required maxLength={36} />
            </label>
            <label>
              Current recovery HOLD reason
              <select name="reason" required>
                {state.reasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={
                !state.ready || !state.history.length || !state.reasons.length
              }
            >
              Record recovery incident for external escalation
            </button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Independent original alert delivery evidence</h2>
          <ul>
            {state.incidents.map((incident) => (
              <li key={incident.id}>
                <code>{incident.id}</code> · {incident.reason} ·{" "}
                {incident.delivered
                  ? "Historical signed delivery verified"
                  : "DELIVERY HOLD"}
              </li>
            ))}
          </ul>
          {params.result === "submitted" && (
            <p>Provider accepted submission; signed delivery remains HOLD.</p>
          )}
          <form action={dispatchRecovery282Action}>
            <label>
              Pending incident ID (original opener only)
              <input name="id" required maxLength={36} />
            </label>
            <button disabled={!state.ready || !state.incidents.length}>
              Submit to configured independent provider
            </button>
          </form>
          <form action={recordDelivery282Action}>
            <label>
              Original recovery incident ID
              <input name="id" required maxLength={36} />
            </label>
            <label>
              Exact original provider-signed delivery JSON
              <textarea name="body" required maxLength={2400} />
            </label>
            <label>
              Original provider Ed25519 base64url signature
              <textarea name="signature" required maxLength={86} />
            </label>
            <button disabled={!state.ready || !state.incidents.length}>
              Independently verify original delivery receipt
            </button>
          </form>
        </section>
      </div>
    </SysopShell>
  );
}
