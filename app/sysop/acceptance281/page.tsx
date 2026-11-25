import type {Metadata} from "next";
import Link from "next/link";
import {SysopShell} from "@/components/sysop-shell";
import {requireSysop} from "@/lib/platform/access";
import {acceptanceSummary281} from "@/lib/build281/postgres.mjs";
import {
 custodyAudit281Action,ownerContinuity281Action,
 externalFinalAck281Action,monitorSnapshot281Action,
} from "./actions";
export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"Build 281 verified original provider and recovery continuity · iCamp",
 robots:{index:false,follow:false},
};
const uuid="[a-fA-F0-9-]{36}";
const sha="[a-f0-9]{64}";
export default async function Acceptance281Page({
 searchParams,
}:Readonly<{searchParams:Promise<{
 custody?:string;owner?:string;ack?:string;monitor?:string;
}>}>){
 await requireSysop("/sysop");
 const [result,p]=await Promise.all([acceptanceSummary281(),searchParams]);
 return(
  <SysopShell>
   <div className="page-stack standard-ops-page">
    <nav className="breadcrumbs">
     <Link href="/sysop">Rosevear Admin Shell</Link>
     <span>/</span><span>Build 281 original provider custody and recovery</span>
    </nav>
    <section className="hero-panel meadow-hero">
     <p className="eyebrow">Build 281 · live original evidence monitoring</p>
     <h1>Real provider custody, continuing Rosevear MFA and external restore acknowledgment</h1>
     <p className="hero-panel__lead">
      All checks use the verified ORIGINAL production host and actual private
      evidence. The external provider must sign the final acknowledgment
      with the previously reviewed private Ed25519 key, held outside iCamp.
      This page has no ability to restore production, reset passwords,
      create signing keys, grant access or certify a provider without evidence.
     </p>
    </section>
    <section className="content-panel" aria-live="polite">
     <h2>Original acceptance monitor: {result.status}</h2>
     <p>Database identity: <strong>{result.admission.host.status}</strong></p>
     <p>Original migration 0255: <strong>{result.admission.status}</strong></p>
     <p>Current original source correlations: <strong>{result.sourceCount}/7</strong></p>
     <p>Current provider signed external ACK: <strong>{result.monitoring.signedProviderCurrent?"YES — CRYPTO VERIFIED":"HOLD"}</strong></p>
     <p>Owner MFA session continuity: <strong>{result.monitoring.ownerMfaCurrent?"CURRENT INDEPENDENT REVIEW":"HOLD"}</strong></p>
     <p>Fresh verified independent snapshot: <strong>{result.monitoring.independentReviewLive?"CURRENT":"HOLD"}</strong></p>
     <p>Production database restored by this console: <strong>NO</strong></p>
     <p>
      These are moment-in-time readbacks. An expired owner session, source
      receipt or provider acknowledgment automatically returns to HOLD.
      A recorded earlier certificate never overrides a stale live check.
     </p>
     <p><Link href="/sysop/acceptance281">Refresh original evidence readback</Link></p>
     <p>
      <Link href="/sysop/acceptance280">Build 280 independently reviewed provider certificate</Link>
      {" · "}
      <Link href="/sysop/acceptance279">Build 279 original seven-source correlations</Link>
      {" · "}
      <Link href="/auth/original-source-setup277">Owner original database and MFA setup</Link>
     </p>
    </section>
    <section className="content-panel">
     <h2>1. Separate original provider signing-key custody audit</h2>
     <p>
      A new, independently approved AAL2 reviewer compares the actual external
      provider public Ed25519 key and original Build 280 signed closure
      against the original provider through a trusted out-of-band channel.
      The server rechecks the original stored signature, approved fingerprint,
      backup manifest and host identities before accepting this immutable audit.
     </p>
     <ul>{result.custodyCandidates.map(x=>(
      <li key={x.id}>{x.providerId}: <code>{x.id}</code></li>
     ))}</ul>
     {p.custody?(
      <p role="status">{p.custody==="recorded"?
       "Independent original provider custody audit recorded; new external provider signature still required.":
       "HOLD — original verified provider closure or different AAL2 reviewer missing."}</p>
     ):null}
     <form action={custodyAudit281Action}>
      <label>Genuine Build 280 provider-signed closure UUID
       <input name="providerClosureId" required maxLength={36} pattern={uuid} autoComplete="off"/>
      </label>
      <label>Out-of-band independently witnessed original provider custody SHA-256
       <input name="evidenceDigest" required maxLength={64} minLength={64} pattern={sha} autoComplete="off"/>
      </label>
      <button type="submit">Record original independent provider custody audit</button>
     </form>
     <p>Accepted independent custody audits:</p>
     <ul>{result.custodyReviews.map(x=>(
      <li key={x.id}>Audit <code>{x.id}</code> · closure <code>{x.closureId}</code></li>
     ))}</ul>
    </section>
    <section className="content-panel">
     <h2>2. Independently witnessed continuing original Rosevear MFA</h2>
     <p>
      The original Rosevear account session must still be active,
      independently bound to the platform, recently reauthenticated
      at AAL2, and separately witnessed. A new approved operator,
      distinct from the owner and previous reviewers, must verify it
      within the actual fifteen-minute MFA window.
     </p>
     <ul>{result.mfaWitnessCandidates.map(x=>(
      <li key={x.id}>
       Original witnessed recovery <code>{x.id}</code> · live session <code>{x.sessionId}</code>
      </li>
     ))}</ul>
     {p.owner?(
      <p role="status">{p.owner==="recorded"?
       "Independent original MFA continuity review recorded; the session must remain live.":
       "HOLD — real current original Rosevear MFA or separate reviewer missing."}</p>
     ):null}
     <form action={ownerContinuity281Action}>
      <label>Actual original Build 280 owner witness UUID
       <input name="originalWitnessId" required maxLength={36} pattern={uuid} autoComplete="off"/>
      </label>
      <label>Original active owner session UUID
       <input name="sessionId" required maxLength={36} pattern={uuid} autoComplete="off"/>
      </label>
      <label>Independent original owner MFA continuity evidence SHA-256
       <input name="evidenceDigest" required maxLength={64} minLength={64} pattern={sha} autoComplete="off"/>
      </label>
      <button type="submit">Witness current original owner MFA continuity</button>
     </form>
     <p>Currently valid continuity evidence:</p>
     <ul>{result.mfaContinuity.map(x=>(
      <li key={x.id}>Continuity <code>{x.id}</code> · session <code>{x.sessionId}</code></li>
     ))}</ul>
    </section>
    <section className="content-panel">
     <h2>3. Fresh final acceptance signed by the ACTUAL external restore provider</h2>
     <p>
      The external backup provider, not an iCamp administrator, signs a new
      five-minute acknowledgment with its separately approved original
      Ed25519 key. The signed JSON binds the Build 280 certificate,
      original provider closure, prior signed digest, provider ID, original
      and isolated host fingerprints and a new unique provider nonce/event.
      Seven original source-correlated receipts and the real current MFA
      continuity are required. No arbitrary digest or sample signature is accepted.
     </p>
     <p>Original certificate candidates:</p>
     <ul>{result.ackCandidates.map(x=>(
      <li key={x.id}>Certificate <code>{x.id}</code> · provider closure <code>{x.closureId}</code></li>
     ))}</ul>
     {p.ack?(
      <p role="status">{p.ack==="verified"?
       "Original external provider final ACK Ed25519 signature independently verified; monitor witness required.":
       "HOLD — independent provider key, genuine signed ACK, seven sources, original MFA or reviewer missing."}</p>
     ):null}
     <form action={externalFinalAck281Action}>
      <label>Build 280 genuine isolated review certificate UUID
       <input name="certificateId" required maxLength={36} pattern={uuid} autoComplete="off"/>
      </label>
      <label>Build 281 independent provider custody audit UUID
       <input name="custodyReviewId" required maxLength={36} pattern={uuid} autoComplete="off"/>
      </label>
      <label>Build 281 current original owner MFA continuity UUID
       <input name="ownerContinuityId" required maxLength={36} pattern={uuid} autoComplete="off"/>
      </label>
      <label>Exact external provider-signed JSON, unchanged UTF-8 bytes
       <textarea name="body" required rows={7} maxLength={3200}/>
      </label>
      <label>Genuine external provider Ed25519 base64url signature (public output)
       <textarea name="signature" required rows={2} maxLength={100}/>
      </label>
      <button type="submit">Verify actual provider signed final restore acknowledgment</button>
     </form>
    </section>
    <section className="content-panel">
     <h2>4. Independent original monitoring receipt</h2>
     <p>
      A DIFFERENT qualified original AAL2 reviewer rechecks the actual
      provider-signed final acknowledgment, current Rosevear session,
      original host and all seven fresh source correlations. An immutable
      timestamped monitor observation is stored only after those checks.
      This monitoring happens on page read and approved sample action;
      it is not an unattended external provider polling service.
     </p>
     {result.signedAck?(
      <p>Current verified external ACK: <code>{result.signedAck.id}</code>
       {" · "}{result.signedAck.providerId}</p>
     ):<p>Original externally signed final ACK: HOLD</p>}
     {p.monitor?(
      <p role="status">{p.monitor==="recorded"?
       "Original independently witnessed monitor receipt recorded; freshness must be rechecked.":
       "HOLD — original source, provider signed ACK, owner MFA or different monitoring reviewer missing."}</p>
     ):null}
     <form action={monitorSnapshot281Action}>
      <label>Current genuine cryptographically verified external ACK UUID
       <input name="ackId" required maxLength={36} pattern={uuid} autoComplete="off"/>
      </label>
      <label>Separate original provider and owner monitoring evidence SHA-256
       <input name="evidenceDigest" required maxLength={64} minLength={64} pattern={sha} autoComplete="off"/>
      </label>
      <button type="submit">Capture independent moment-in-time original monitor receipt</button>
     </form>
     <p>Recorded immutable monitor observations:</p>
     <ul>{result.samples.map(x=>(
      <li key={x.id}>
       <code>{x.id}</code> · original ACK <code>{x.ackId}</code>
       {" · "}{String(x.observedAt)}
      </li>
     ))}</ul>
    </section>
   </div>
  </SysopShell>
 );
}
