"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSysop } from "@/lib/platform/access";
import {
  recordFieldAttestation278,
  recordOwnerMfaReadback278,
  recordRestoreServiceReadback278,
} from "@/lib/build278/postgres.mjs";

const route="/sysop/acceptance278";
export async function fieldAttestation278Action(form:FormData){
  const {session}=await requireSysop("/sysop");
  try{
    await recordFieldAttestation278({
      reviewerId:session.user.id,
      responseId:String(form.get("responseId")??""),
      evidenceDigest:String(form.get("evidenceDigest")??""),
    });
    revalidatePath(route);
  }catch{redirect(route+"?field=hold");}
  redirect(route+"?field=recorded");
}
export async function ownerMfaReadback278Action(form:FormData){
  const {session}=await requireSysop("/sysop");
  try{
    await recordOwnerMfaReadback278({
      reviewerId:session.user.id,
      ownerId:String(form.get("ownerId")??""),
      sessionId:String(form.get("sessionId")??""),
      evidenceDigest:String(form.get("evidenceDigest")??""),
    });
    revalidatePath(route);
  }catch{redirect(route+"?mfa=hold");}
  redirect(route+"?mfa=recorded");
}
export async function restoreServiceReadback278Action(form:FormData){
  const {session}=await requireSysop("/sysop");
  try{
    await recordRestoreServiceReadback278({
      reviewerId:session.user.id,
      externalReviewId:String(form.get("externalReviewId")??""),
      providerDigest:String(form.get("providerDigest")??""),
      isolatedDigest:String(form.get("isolatedDigest")??""),
      evidenceDigest:String(form.get("evidenceDigest")??""),
    });
    revalidatePath(route);
  }catch{redirect(route+"?restore=hold");}
  redirect(route+"?restore=recorded");
}
