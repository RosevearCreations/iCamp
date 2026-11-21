import type {Metadata} from "next";
import Link from "next/link";
import {SysopShell} from "@/components/sysop-shell";
import {requireSysop} from "@/lib/platform/access";
import {sourceReadiness270,inspectOwnerEnrollment270,
 originalRestoreCertification270} from "@/lib/build270/postgres.mjs";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Original host enrollment and recovery · iCamp",
 robots:{index:false,follow:false}};
export default async function OriginalRecovery270Page(){
 await requireSysop("/sysop");
 const [source,owner,restore]=await Promise.all([
  sourceReadiness270(),inspectOwnerEnrollment270(),originalRestoreCertification270(),
 ]);
 return <SysopShell><div className="page-stack standard-ops-page">
  <section className="hero-panel meadow-hero">
   <p className="eyebrow">Build 270 · Rosevear operator-only</p>
   <h1>Original-host source enrollment, delivery and recovery</h1>
   <p className="hero-panel__lead">Every status below is drawn from the original
   runtime connection or a real server-only credential. No fake test payments,
   email delivery, privileged account activation or restore certification.</p>
  </section>
  <section className="content-panel">
   <h2>Production source admission</h2>
   <p><strong>{source.status}</strong></p>
   <p>Independent database host pin matched: {source.database.runtimeTargetPinMatches?"Yes":"HOLD"}.
   Original migration 0245: {source.adoption270?"Found":"HOLD"}.</p>
   <p>Camp Rosevear live traffic source pair: {source.trafficPaired?"Configured; independently verify first sample":"HOLD — not enrolled"}.</p>
   <p>Authenticated Comms outbound source: {source.commsOutboundReady?
    "Configured; real recipient delivery still unproven":"HOLD — missing original signed provider"}.</p>
   <p>Read-only payment processor test access: {source.providerReadOnlyReady?
    "Configured; processor settlement still requires original evidence":"HOLD — not configured"}.</p>
   <p>Comms dispatch may only claim one original notice; accepted by receiver
    is not the same as delivered to the assigned platform staff member.
    The signed downstream provider receipt remains separately verified.</p>
  </section>
  <section className="content-panel">
   <h2>Rosevear outer Shell owner login check</h2>
   <p><strong>{owner.status}</strong></p>
   <div className="ops-kpi-grid">
    <article className="ops-kpi"><span>Original identity</span><strong>{owner.accountFound?"Present":"HOLD"}</strong></article>
    <article className="ops-kpi"><span>Enabled staff account</span><strong>{owner.accountActive?"Yes":"HOLD"}</strong></article>
    <article className="ops-kpi"><span>Password credential</span><strong>{owner.credentialPresent?"Present":"HOLD"}</strong></article>
    <article className="ops-kpi"><span>Verified recovery email</span><strong>{owner.recoveryEmailVerified?"Yes":"HOLD"}</strong></article>
    <article className="ops-kpi"><span>Approved platform grant</span><strong>{owner.platformGrantActive?"Yes":"HOLD"}</strong></article>
    <article className="ops-kpi"><span>Verified MFA factor</span><strong>{owner.mfaVerified?"Yes":"HOLD"}</strong></article>
   </div>
   <p>One-time owner bootstrap or a temporary password alone must not bypass
    original source verification, independent owner approval, verified email,
    MFA enrollment, pending platform grants or login lockout protections.</p>
   <p><Link href="/auth/owner-access">Owner recovery instructions without email enumeration</Link></p>
  </section>
  <section className="content-panel">
   <h2>Independent restoration and proof custody</h2>
   <p><strong>{restore.status}</strong></p>
   <p>Recorded original witness chains: {restore.originalEvidenceChains??"UNKNOWN"}.
    Actual isolated original-host restore independently certified:
    {restore.externalHostRestorationVerified?"YES":"NO / HOLD"}.</p>
   <p>Written witness evidence is not a database restore. Actual source hashes,
    tenant-isolation readback, backup reconstruction, and independent reviewer
    acceptance must be completed before claiming recovery GREEN.</p>
  </section>
  <section className="content-panel">
   <p><Link href="/sysop/pilot269">Live traffic and earlier Camp Rosevear pilot</Link> ·
    <Link href="/sysop/support265">Escalated SLA queue</Link> ·
    <Link href="/sysop/readiness">Production source custody</Link></p>
  </section>
 </div></SysopShell>;
}
