"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireCampgroundPermission} from "@/lib/authz/current-user";
import {compareOriginalPayment270} from "@/lib/build270/postgres.mjs";
const path="/workspaces/management/campgrounds/booking-recovery268";
export async function compareOriginalPayment270Action(form:FormData){
 const campgroundId=String(form.get("campgroundId")??"");
 const session=await requireCampgroundPermission(campgroundId,
  "campground.operations.manage",path);
 let status="HOLD";
 try{
  const result=await compareOriginalPayment270({
   userId:session.user.id,campgroundId,
   recoveryId:String(form.get("recoveryId")??""),
   paymentId:String(form.get("paymentId")??""),
  });
  status=result.matched?"PROVIDER_CHECKED":"HOLD";
  revalidatePath(path);
 }catch(e){
  if(e && typeof e==="object" && "digest" in e)throw e;
 }
 redirect(path+"?campground="+encodeURIComponent(campgroundId)+
  "&provider270="+encodeURIComponent(status));
}
