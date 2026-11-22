import type {Metadata} from "next";
import Link from "next/link";
import {SysopShell} from "@/components/sysop-shell";
import {requireSysop} from "@/lib/platform/access";
import {originalAdmission271,originalSources271,originalOwnerCeremony271,
 originalReplayStatus271} from "@/lib/build271/postgres.mjs";
import {recordOwnerStage271Action,recordRestoreReplay271Action} from "./actions";
export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"Owner Enrollment & Source Verification · iCamp",
 robots:{index:false,follow:false},
};
export default async function Enrollment271Page({searchParams}:Readonly<{
 searchParams:Promise<{owner271?:string;replay271?:string}>;
}>){
 await requireSysop("/sysop");
 const params=await searchParams;
 const [source,owner,replay,admission]=await Promise.all([
  originalSources271(),originalOwnerCeremony271(),originalReplayStatus271(),
  originalAdmission271(),
 ]);
 return <SysopShell><div className="page-stack standard-ops-page">
  <nav className="breadcrumbs"><Link href="/sysop">Rosevear Admin Shell</Link>
   <span>/</span><span>Build 271 — independently witnessed sources</span></nav>
  <section className="hero-panel meadow-hero">
   <p className="eyebrow">Build 271 · source truth, not simulated acceptance</p>
   <h1>Owner ceremony, real source pairing and restoration replay</h1>
   <p className="hero-panel__lead">Original production source checks and
    independent reviewer receipts only. No automatic owner permissions,
    credential resets, payment capture, refund, guest contact, or actual backup
    restoration are initiated by this screen.</p>
  </section>
  <section className="content-panel">
   <h2>Original production database</h2>
   <p><strong>{admission.status}</strong></p>
   <p>Build 270 original host pin and migration verified:
    {admission.adopted?" Yes — external acceptance still required":" HOLD"}.</p>
   <p>The deployment may be READY even when this original database remains
    unpinned or the migration has not been applied. Do not adopt a different
    Supabase project merely because it contains a sample Camp Rosevear.</p>
  </section>
  <section className="content-panel">
   <h2>Rosevear owner identity and independent enrollment</h2>
   <p><strong>{owner.status}</strong></p>
   <p>Original identity state: {owner.owner?.status??"HOLD"}. Independent stages:</p>
   <table><thead><tr><th>Witnessed stage</th><th>Receipt</th></tr></thead>
    <tbody>{owner.stages.map(x=><tr key={x.kind}><td>{x.kind}</td>
      <td>{x.witnessed?"Recorded; verify original source":"HOLD"}</td></tr>)}</tbody>
   </table>
   <p>Verified original contact: {owner.owner?.recoveryEmailVerified?"YES":"HOLD"};
    password credential: {owner.owner?.credentialPresent?"PRESENT":"HOLD"};
    MFA: {owner.owner?.mfaVerified?"VERIFIED":"HOLD"};
    approved independent platform grant: {owner.owner?.platformGrantActive?"ACTIVE":"HOLD"}.</p>
   <p>Only another independently authenticated Rosevear platform operator may
    attest to an original completed stage. A receipt cannot perform a step
    or activate a disabled identity.</p>
   {params.owner271?<p role="status">{params.owner271==="recorded"?
    "Evidence receipt recorded; permissions unchanged.":
    "HOLD — source evidence or independently verified reviewer missing."}</p>:null}
   <form action={recordOwnerStage271Action}>
    <label>Original owner verification stage
      <select name="stage" required>
       <option value="contact_verified">Contact verified on original account</option>
       <option value="credential_present">Password verifier set via private channel</option>
       <option value="mfa_verified">Original MFA independently verified</option>
       <option value="platform_binding_verified">Platform grant and owner binding approved</option>
      </select>
    </label>
    <label>Original private verification document SHA-256
      <input name="evidenceDigest" required pattern="[a-f0-9]{64}"
       minLength={64} maxLength={64} autoComplete="off"/></label>
    <button type="submit">Record independent owner witness</button>
   </form>
   <p>No password, email address, private recovery code, or MFA seed is
    requested or shown. <Link href="/auth/owner-access">Owner access instructions</Link>.</p>
  </section>
  <section className="content-panel">
   <h2>Camp Rosevear source identity and delivery pairing</h2>
   <p><strong>{source.status}</strong>; tenant lifecycle:
    {source.campground}.</p>
   <table><thead><tr><th>Original source</th><th>Proof health</th>
     <th>Credential pair configured</th></tr></thead><tbody>
     {source.proofs.map(x=><tr key={x.kind}>
      <td>{x.kind}</td><td>{x.status}</td>
      <td>{x.sourceConfigured?"Configured, not externally certified":"HOLD"}</td>
     </tr>)}</tbody></table>
   <p>Traffic consent must be active and a fresh original sample received.
    Comms delivery requires the signed downstream provider acknowledgment,
    not merely a successful API request. Payment success requires an original
    processor and guest confirmation; this view contains no tenant finance.</p>
  </section>
  <section className="content-panel">
   <h2>Original backup and restored-system evidence replay</h2>
   <p><strong>{replay.status}</strong>; recorded receipts:
    {replay.receipts??"UNKNOWN"}</p>
   <p>Three separate observations—original, isolated restore, and current
    production readback—must match for each canonical tenant isolation,
    reservation, payment ledger and service health digest. Distinct reviewers
    and the Build 269 independent backup chain are required. Matching hashes
    alone cannot certify that a real backup was restored.</p>
   {params.replay271?<p role="status">{params.replay271==="recorded"?
    "Replay witness recorded; original host restoration still unverified.":
    "HOLD — independent backup chain or reviewer evidence missing."}</p>:null}
   <form action={recordRestoreReplay271Action}>
    <label>Original backup SHA-256<input required name="backupDigest"
     pattern="[a-f0-9]{64}" minLength={64} maxLength={64}/></label>
    <label>Observed environment
     <select name="snapshot" required>
      <option value="original">Original protected source</option>
      <option value="isolated">Separate restored database</option>
      <option value="production_readback">Current live source readback</option>
     </select></label>
    <label>Evidence scope
     <select name="kind" required>
      <option value="tenant_isolation">Tenant isolation</option>
      <option value="reservation_integrity">Reservation integrity</option>
      <option value="payment_ledger">Original payment ledger</option>
      <option value="service_health">Service and traffic health</option>
     </select></label>
    <label>Canonical scoped evidence SHA-256<input required name="fingerprint"
     pattern="[a-f0-9]{64}" minLength={64} maxLength={64}/></label>
    <button type="submit">Record independently witnessed replay</button>
   </form>
   <p>No actual backup, restore, or payment operation happens from this form.</p>
  </section>
  <section className="content-panel">
   <p><Link href="/sysop/recovery270">Earlier original-host and owner readiness</Link> ·
     <Link href="/sysop/pilot269">Camp Rosevear performance pilot</Link></p>
  </section>
 </div></SysopShell>;
}
