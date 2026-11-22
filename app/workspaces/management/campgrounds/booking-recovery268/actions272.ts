"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireCampgroundPermission} from "@/lib/authz/current-user";
import {recordProviderBooking272} from "@/lib/build272/postgres.mjs";
const route="/workspaces/management/campgrounds/booking-recovery268";
export async function recordProviderBooking272Action(form:FormData){
 const campgroundId=String(form.get("campgroundId")??"");
 const {user}=await requireCampgroundPermission(campgroundId,"campground.operations.manage",route);
 try{
  await recordProviderBooking272({
   reviewerId:user.id,campgroundId,
   recoveryId:String(form.get("recoveryId")??""),
   traceId:String(form.get("traceId")??""),
   processorWitnessId:String(form.get("processorWitnessId")??""),
   siteWitnessId:String(form.get("siteWitnessId")??""),
   deliveryWitnessId:String(form.get("deliveryWitnessId")??""),
   guestWitnessId:String(form.get("guestWitnessId")??""),
   evidenceDigest:String(form.get("evidenceDigest")??""),
  });
  revalidatePath(route);
 }catch(e){if(e&&typeof e==="object"&&"digest" in e)throw e;
  redirect(route+"?campground="+encodeURIComponent(campgroundId)+"&field272=hold");}
 redirect(route+"?campground="+encodeURIComponent(campgroundId)+"&field272=recorded");
}
