"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireSysop} from "@/lib/platform/access";
import {
 recordCustodyAudit281,recordOwnerContinuity281,
 recordExternalFinalAck281,recordMonitorSample281,
} from "@/lib/build281/postgres.mjs";
const route="/sysop/acceptance281";
export async function custodyAudit281Action(form:FormData){
 const {session}=await requireSysop("/sysop");
 try{
  await recordCustodyAudit281({
   reviewerId:session.user.id,
   providerClosureId:String(form.get("providerClosureId")??""),
   evidenceDigest:String(form.get("evidenceDigest")??""),
  });
  revalidatePath(route);
 }catch{redirect(route+"?custody=hold");}
 redirect(route+"?custody=recorded");
}
export async function ownerContinuity281Action(form:FormData){
 const {session}=await requireSysop("/sysop");
 try{
  await recordOwnerContinuity281({
   reviewerId:session.user.id,
   originalWitnessId:String(form.get("originalWitnessId")??""),
   sessionId:String(form.get("sessionId")??""),
   evidenceDigest:String(form.get("evidenceDigest")??""),
  });
  revalidatePath(route);
 }catch{redirect(route+"?owner=hold");}
 redirect(route+"?owner=recorded");
}
export async function externalFinalAck281Action(form:FormData){
 const {session}=await requireSysop("/sysop");
 try{
  await recordExternalFinalAck281({
   reviewerId:session.user.id,
   certificateId:String(form.get("certificateId")??""),
   custodyReviewId:String(form.get("custodyReviewId")??""),
   ownerContinuityId:String(form.get("ownerContinuityId")??""),
   body:String(form.get("body")??""),
   signature:String(form.get("signature")??""),
  });
  revalidatePath(route);
 }catch{redirect(route+"?ack=hold");}
 redirect(route+"?ack=verified");
}
export async function monitorSnapshot281Action(form:FormData){
 const {session}=await requireSysop("/sysop");
 try{
  await recordMonitorSample281({
   reviewerId:session.user.id,
   ackId:String(form.get("ackId")??""),
   evidenceDigest:String(form.get("evidenceDigest")??""),
  });
  revalidatePath(route);
 }catch{redirect(route+"?monitor=hold");}
 redirect(route+"?monitor=recorded");
}
