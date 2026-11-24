import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Build 277 owner field setup · iCamp",
  robots: { index: false, follow: false },
};
export default function Build277OwnerFieldSetup() {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="content-panel auth-panel">
          <p className="eyebrow">
            Build 277 · manual steps when original proof is unavailable
          </p>
          <h1>Original iCamp owner setup: where, how and when</h1>
          <p>
            Follow these steps{" "}
            <strong>after Build 277 reaches Vercel production READY</strong>. Do
            not send database passwords, source private keys, or recovery
            credentials to a chat or put them into a public ticket.
          </p>
          <h2>
            Step 1 — Confirm the original production database, before changing
            settings
          </h2>
          <ol>
            <li>
              Open the original iCamp Supabase project in its secure Dashboard.
            </li>
            <li>
              Find the original application connection string under{" "}
              <strong>Connect</strong> and identify its host. Confirm it is the
              original production project, not a demo or an unrelated Supabase
              tenant.
            </li>
            <li>
              Open Vercel, select <strong>i-camp</strong>, then{" "}
              <strong>Settings → Environment Variables</strong>. Confirm the
              existing sensitive <code>DATABASE_URL</code> points to that same
              original project and connection endpoint. Do not copy the password
              or entire URL into a chat.
            </li>
            <li>
              If the two hosts cannot be independently matched, stop. Do not
              change <code>DATABASE_URL</code>, adopt migrations or approve
              source signers.
            </li>
          </ol>
          <h2>Step 2 — Add the expected database-host pin, then redeploy</h2>
          <ol>
            <li>
              In Vercel{" "}
              <strong>i-camp → Settings → Environment Variables</strong>, select{" "}
              <strong>Add Variable</strong>.
            </li>
            <li>
              Key: <code>ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST</code>. Value:
              the exact hostname (not URL, username or password) used by
              iCamp&apos;s verified original <code>DATABASE_URL</code>.
            </li>
            <li>
              Choose <strong>Production</strong> and save. Do not alter the
              existing database URL or secrets.
            </li>
            <li>
              Open <strong>Deployments</strong>, select the Build 277{" "}
              <strong>main</strong> production deployment and choose{" "}
              <strong>Redeploy</strong> so the new variable is loaded. Do this
              once after the pin is verified and saved.
            </li>
            <li>
              Check <Link href="/api/health/ready">production health</Link>. A
              READY result does not itself prove original host identity or
              migration adoption.
            </li>
          </ol>
          <h2>
            Step 3 — Verify original database migration adoption, without
            replacing data
          </h2>
          <ol>
            <li>
              In the original secure database, inspect{" "}
              <code>icamp_meta.schema_migrations</code> for versions 0241
              through 0251.
            </li>
            <li>
              Use the repository&apos;s controlled existing migration workflow{" "}
              <code>npm run db:migrate</code> only after verifying its database
              target and securing the approval to deploy schema to that exact
              original environment. Do not run the script against a sample
              project or another tenant.
            </li>
            <li>
              Check the operator{" "}
              <Link href="/sysop/migration-audit">migration audit</Link> after
              original sign-in. Automated CI migration success alone is not
              proof the production host is adopted.
            </li>
          </ol>
          <h2>
            Step 4 — Complete original Rosevear sign-in and independent MFA
          </h2>
          <ol>
            <li>
              Go to{" "}
              <Link href="/auth/owner-diagnostics">
                Rosevear login diagnostics
              </Link>
              , then <Link href="/auth/login?next=%2Fsysop">sign in</Link> with
              username <code>Rosevear</code> and the personal password already
              chosen.
            </li>
            <li>
              If a first password has never been set, use{" "}
              <Link href="/auth/owner-setup">
                the original private one-time setup
              </Link>{" "}
              only while the owner-issued credential is still valid. An expired
              or already-used credential requires privately verified reissuance,
              never a guessed password.
            </li>
            <li>
              Complete actual authenticator MFA. Independent owner binding and a
              separate, genuine login witness are still required for operator
              access; this feature does not create new platform grants.
            </li>
          </ol>
          <h2>Step 5 — Enroll and prove each original app signer</h2>
          <ol>
            <li>
              In{" "}
              <Link href="/sysop/acceptance276">Build 276 operator review</Link>
              , stage each original application&apos;s real Ed25519 SPKI public
              key and exact deployed commit revision (never its private key).
            </li>
            <li>
              Have a different verified AAL2 operator check the source
              fingerprint out-of-band and approve its signer proposal.
            </li>
            <li>
              While freshly MFA-authenticated as the original Rosevear operator,
              use{" "}
              <Link href="/sysop/acceptance277">
                Build 277 operator acceptance
              </Link>{" "}
              to adopt the verified proposal using the separate trusted
              source-custody evidence digest.
            </li>
            <li>
              On each original application&apos;s signer service, sign the
              challenge request and send it to iCamp&apos;s Build 277 challenge
              endpoint. Receive the random server challenge; sign a distinct
              response within 90 seconds and send it to the response endpoint.
            </li>
            <li>
              Repeat for all seven sources and check their live readback
              immediately (within five minutes). A signed request is never the
              same as a verified response.
            </li>
          </ol>
          <h2>
            Step 6 — Isolated external restore and independent final review
          </h2>
          <ol>
            <li>
              Use the real backup provider to restore to an isolated
              environment, not live production. Independently check tenant
              isolation, reservation integrity, payment ledger and service
              health.
            </li>
            <li>
              Record the original signed provider host attestation and its Build
              272/273/276 predecessor evidence only after the provider reports
              the results.
            </li>
            <li>
              A different qualified platform operator checks the provider&apos;s
              original and isolated host fingerprints and records the Build 277
              external review using the protected console.
            </li>
            <li>
              The review receipt never executes a restore and never substitutes
              for independent external service acceptance. Keep the production
              restore status on HOLD until the actual provider and reviewer
              confirm the outcome.
            </li>
          </ol>
          <p>
            These steps are deliberately fail-closed: without original account,
            independent host identity or distinct reviewers, the application
            reports HOLD rather than creating fictitious proof.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
