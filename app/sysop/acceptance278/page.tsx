import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { acceptanceSummary278 } from "@/lib/build278/postgres.mjs";
import {
  fieldAttestation278Action,
  ownerMfaReadback278Action,
  restoreServiceReadback278Action,
} from "./actions";

export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Build 278 original field certification review · iCamp",
  robots:{index:false,follow:false},
};
const uuid="[a-fA-F0-9-]{36}",sha="[a-f0-9]{64}";

export default async function Acceptance278Page({
  searchParams,
}:Readonly<{searchParams:Promise<{
  field?:string;mfa?:string;restore?:string;
}>}>){
  const {session}=await requireSysop("/sysop");
  const [result,p]=await Promise.all([
    acceptanceSummary278(session),searchParams]);
  return(
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs">
          <Link href="/sysop">Rosevear Admin Shell</Link>
          <span>/</span>
          <span>Build 278 original field readback</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 278 · source evidence, independent reviews</p>
          <h1>Seven original peers, owner MFA and external restore service</h1>
          <p className="hero-panel__lead">
            A fully tested application release does not certify original signer
            custody, a physical backup restore, owner recovery or external service.
            Every operational gate below requires evidence from its original source
            and a different verified reviewer. This page cannot alter a credential,
            grant, booking, payment or production backup.
          </p>
        </section>
        <section className="content-panel" aria-live="polite">
          <h2>Original recovery closure</h2>
          <p><strong>{result.closure.status}</strong></p>
          <p>Original host: {result.admission.host.status}</p>
          <p>Original migration 0252: {result.admission.status}</p>
          <p>Current Rosevear MFA completion: {result.owner.status}</p>
          <p>Original field witness readback: {result.peers.reviewedCount}/7</p>
          <p>Independent external restore service: {result.restore.status}</p>
          <p>Production database restored by this console: <strong>NO</strong></p>
          <p>
            <Link href="/auth/original-source-setup277">
              Original database, MFA and signing setup instructions
            </Link>
            {" · "}
            <Link href="/sysop/acceptance277">Original field challenge drill</Link>
            {" · "}
            <Link href="/sysop/acceptance276">Independent source public key reviews</Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Original seven-source field review</h2>
          <p>
            A distinct AAL2 platform operator reviews the real source&apos;s public
            fingerprint and the original Build 277 signed challenge response.
            Only responses accepted within the past five minutes can be
            independently attested here. The app cryptographically rechecks the
            signed bytes against the owner-approved key on readback.
          </p>
          <ul>
            {result.peers.peers.map(x=>(
              <li key={x.source}><strong>{x.source}: {x.status}</strong></li>
            ))}
          </ul>
          <ul>
            {result.peers.records.map(x=>(
              <li key={x.responseId}>
                {x.source} · {x.signed?"SIGNED":"HOLD"} · {x.reviewed?"REVIEW RECORDED":"NEEDS REVIEW"}
                <p>Original challenge response: <code>{x.responseId}</code></p>
              </li>
            ))}
          </ul>
          {p.field?(
            <p role="status">{p.field==="recorded"?
              "Independent original field receipt recorded; external signer custody remains a separate check.":
              "HOLD — original pinned response, freshness, independent reviewer or schema missing."}</p>
          ):null}
          <form action={fieldAttestation278Action}>
            <label>Original signed challenge response UUID
              <input name="responseId" required maxLength={36} pattern={uuid}
                autoComplete="off"/>
            </label>
            <label>Independent original application field-evidence SHA-256
              <input name="evidenceDigest" required minLength={64} maxLength={64}
                pattern={sha} autoComplete="off"/>
            </label>
            <button type="submit">Record independently witnessed field signature</button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Original Rosevear MFA recovery completion</h2>
          <p>
            A separate approved platform operator must witness the real active
            Rosevear owner session with recent AAL2 authentication, independent
            Build 272 original login evidence and active approved owner binding.
            The owner cannot review their own login. The login must still be
            active when read back; merely recording a receipt does not authenticate
            anyone and it does not reset any password.
          </p>
          <p>Session readback: <strong>{result.owner.status}</strong></p>
          {session.user.username?.toLowerCase() === "rosevear" ? (
            <p>
              Original owner account UUID: <code>{session.user.id}</code>.
              Current browser session UUID: <code>{session.sessionId}</code>.
              These are identifiers, not passwords or bearer login tokens.
              An independent approved reviewer must verify this active session
              in person or through a trusted private channel.
            </p>
          ) : null}
          {result.owner.owner.checks.map(x=>(
            <p key={x.id}>{x.id}: {x.status}</p>
          ))}
          {p.mfa?(
            <p role="status">{p.mfa==="recorded"?
              "Separate original MFA witness recorded. Fresh Rosevear owner session still required.":
              "HOLD — active original owner login or independent AAL2 reviewer missing."}</p>
          ):null}
          <form action={ownerMfaReadback278Action}>
            <label>Original Rosevear owner account UUID
              <input name="ownerId" required maxLength={36} pattern={uuid} autoComplete="off"/>
            </label>
            <label>Original active owner MFA session UUID
              <input name="sessionId" required maxLength={36} pattern={uuid} autoComplete="off"/>
            </label>
            <label>Independently observed original MFA recovery evidence SHA-256
              <input name="evidenceDigest" required minLength={64} maxLength={64}
                pattern={sha} autoComplete="off"/>
            </label>
            <button type="submit">Record independent owner MFA completion witness</button>
          </form>
        </section>
        <section className="content-panel">
          <h2>External isolated restore service readback closure</h2>
          <p>
            A different independently authorized operator checks the original
            provider&apos;s actual service output, isolated service and their separate
            host fingerprints. This requires the original Build 277 external
            restore review and original Build 272–276 provider chain.
            Recording these external digests never restores production or
            constitutes independent provider certification.
          </p>
          <p>Independent service receipts: {result.restore.evidenceCount}</p>
          <ul>
            {result.restore.records.map(x=>(
              <li key={x.externalReviewId}>
                {x.witnessed?"SERVICE READBACK RECORDED":"PENDING INDEPENDENT REVIEW"}
                <p>Build 277 external review UUID: <code>{x.externalReviewId}</code></p>
              </li>
            ))}
          </ul>
          {p.restore?(
            <p role="status">{p.restore==="recorded"?
              "External service review stored. Real-world provider certification remains separate.":
              "HOLD — distinct real provider and isolated restore service verification missing."}</p>
          ):null}
          <form action={restoreServiceReadback278Action}>
            <label>Build 277 external restore review UUID
              <input name="externalReviewId" required maxLength={36} pattern={uuid}
                autoComplete="off"/>
            </label>
            <label>Original provider service output SHA-256
              <input name="providerDigest" required minLength={64} maxLength={64}
                pattern={sha} autoComplete="off"/>
            </label>
            <label>Isolated restore service output SHA-256
              <input name="isolatedDigest" required minLength={64} maxLength={64}
                pattern={sha} autoComplete="off"/>
            </label>
            <label>Independent external provider comparison evidence SHA-256
              <input name="evidenceDigest" required minLength={64} maxLength={64}
                pattern={sha} autoComplete="off"/>
            </label>
            <button type="submit">Record independent original restore service review</button>
          </form>
        </section>
      </div>
    </SysopShell>
  );
}
