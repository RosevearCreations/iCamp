import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { listAssignedCampgrounds, hasCampgroundPermission } from "@/lib/authz/postgres.mjs";
import { diagnoseCampgroundBooking268 } from "@/lib/campground-support268/postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {title:"Booking confirmation recovery · iCamp",
  robots:{index:false,follow:false}};
export default async function BookingRecovery268Page({searchParams}:{
  searchParams:Promise<{campground?:string;reservation?:string}>;
}) {
 const path="/workspaces/management/campgrounds/booking-recovery268";
 const session=await requireAnyCampgroundPermission("campground.operations.manage",path);
 const all=await listAssignedCampgrounds(session.user.id);
 const allowed=(await Promise.all(all.map(async c=>
   (await hasCampgroundPermission(session.user.id,c.campgroundId,"campground.operations.manage"))
     ?c:null))).filter((x):x is NonNullable<typeof x>=>x!==null);
 const params=await searchParams;
 const selected=allowed.find(x=>x.campgroundId===params.campground)??allowed[0];
 const evidence=selected&&params.reservation
  ? await diagnoseCampgroundBooking268({userId:session.user.id,
      campgroundId:selected.campgroundId,reservationId:params.reservation})
  : null;
 return <AppShell>
  <div className="page-stack">
   <section className="hero-panel">
    <p className="eyebrow">Build 268 · tenant-private service recovery</p>
    <h1>Paid but no confirmation: booking investigation</h1>
    <p className="hero-panel__lead">Campground staff investigate their own reservation,
      provider payment receipts, confirmation and delivery. Platform Sysop only sees
      redacted stage counts. This screen never charges, refunds, changes site availability,
      or sends mail automatically.</p>
   </section>
   <section className="content-panel">
    <h2>Open a campground-scoped booking</h2>
    <form method="get">
     <label>Assigned campground
      <select name="campground" defaultValue={selected?.campgroundId}>
       {allowed.map(c=><option key={c.campgroundId} value={c.campgroundId}>
        {c.campgroundName}</option>)}
      </select></label>
     <label>Reservation UUID
      <input name="reservation" required maxLength={36}
       pattern="[a-fA-F0-9-]{36}" defaultValue={params.reservation??""}
       placeholder="Original reservation reference" />
     </label>
     <button type="submit">Inspect original evidence</button>
    </form>
   </section>
   {evidence ? <section className="content-panel">
    <h2>Original evidence: {evidence.status}</h2>
    <p>Decision: <strong>{evidence.stage}</strong></p>
    {evidence.evidence ? <dl>
      <dt>Reservation state</dt><dd>{evidence.evidence.reservationStatus}</dd>
      <dt>Accepted booking due (cents)</dt><dd>{evidence.evidence.bookingDueCents??"UNKNOWN"}</dd>
      <dt>Internally captured record (cents)</dt><dd>{evidence.evidence.capturedCents}</dd>
      <dt>Provider event receipts (not bank settlement)</dt><dd>{evidence.evidence.providerEventRows}</dd>
      <dt>Reservation confirmation exists</dt><dd>{evidence.evidence.confirmationExists?"Yes":"No"}</dd>
      <dt>Receipt records</dt><dd>{evidence.evidence.receiptRows}</dd>
      <dt>Confirmation delivery</dt><dd>{evidence.evidence.deliveryState}</dd>
      <dt>Independently reconciled provider settlement</dt><dd>NOT VERIFIED</dd>
      <dt>Site hold and overlapping inventory independently verified</dt><dd>NOT VERIFIED</dd>
    </dl> : <p>No trustworthy reservation evidence is available. No financial or booking action should be taken.</p>}
    <p>Required resolution sequence: verify provider settlement independently,
     compare hold expiry and site allocation, preserve the original transaction ID,
     authorize one reservation outcome or one refund, retry only the existing
     confirmation dispatch identifier, then log the guest&apos;s acknowledgment
     and close the local case. Do not charge twice.</p>
    <p><Link href="/workspaces/management/campgrounds/operations-centre265">
     Open local support cases and guest follow-up</Link></p>
   </section> : null}
  </div>
 </AppShell>;
}
