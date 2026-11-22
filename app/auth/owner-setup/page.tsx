import type {Metadata} from "next";
import Link from "next/link";
import {AppShell} from "@/components/app-shell";
export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"Rosevear first password · iCamp",
 description:"Owner-authorized one-time first-login setup",
 robots:{index:false,follow:false}};
export default async function OwnerFirstPassword273({
 searchParams
}:Readonly<{searchParams:Promise<{status?:string}>}>){
 const {status}=await searchParams;
 return <AppShell><div className="page-stack">
  <section className="content-panel auth-panel">
   <p className="eyebrow">Build 273 · Rosevear protected first login</p>
   <h1>Set our first Rosevear password</h1>
   <p>For the original <strong>Rosevear</strong> platform operator account only.
    Use the one-time owner recovery credential issued separately to the
    project owner and choose a new personal password. We will never ask for
    the actual password again in a chat or support ticket.</p>
   <p>One-time credentials expire, cannot be reused, and never overwrite an
    existing password. This setup can enable ordinary sign-in, but platform
    GOD MODE still requires separately verified owner approval and MFA.</p>
   {status?<p role="status" className={status==="hold"?
     "form-message form-message--error":"form-message"}>{
      status==="already"?
      "This identity already has a password. Use the standard verified owner recovery process; the one-time credential cannot overwrite it.":
      "The first-password request could not be completed. The one-time credential may be invalid or expired, or original source enrollment may be unavailable."
    }</p>:null}
   <form className="auth-form" action="/api/auth/owner-setup273" method="post">
    <label><span>Account</span>
     <input type="text" value="Rosevear" autoComplete="username" readOnly/></label>
    <label><span>Private one-time owner recovery credential</span>
     <input name="credential" type="password" autoComplete="off" required
      minLength={32} maxLength={128}/></label>
    <label><span>Choose a new password (12–128 characters)</span>
     <input name="password" type="password" autoComplete="new-password"
      required minLength={12} maxLength={128}/></label>
    <label><span>Confirm our new password</span>
     <input name="confirm" type="password" autoComplete="new-password"
      required minLength={12} maxLength={128}/></label>
    <button className="primary-button" type="submit">
     Set first password for Rosevear</button>
   </form>
   <p>Use a unique 16+ character password where possible. The recovery
    credential is sensitive: do not post it to public issues, screenshots
    or live-stream recordings.</p>
   <p><Link href="/auth/login?next=%2Fauth%2Fmfa">Return to Rosevear sign-in and authenticator setup</Link> ·
    <Link href="/auth/owner-access">Owner MFA and access guidance</Link></p>
  </section></div></AppShell>;
}
