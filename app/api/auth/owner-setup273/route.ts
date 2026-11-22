import {NextRequest,NextResponse} from "next/server";
import {isSameOriginMutation} from "@/lib/auth/request-security";
import {claimFirstRosevearPassword273} from "@/lib/build273/owner-postgres.mjs";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 if(!isSameOriginMutation(request))return NextResponse.json(
  {error:"Invalid request origin."},{status:403,headers:{"cache-control":"no-store"}});
 if(Number(request.headers.get("content-length")??"0")>4096)return NextResponse.json(
  {error:"Request too large."},{status:413,headers:{"cache-control":"no-store"}});
 const form=await request.formData();
 const credential=String(form.get("credential")??"");
 const password=String(form.get("password")??"");
 const confirm=String(form.get("confirm")??"");
 let status="hold";
 if(credential.length<=128&&password.length<=128&&password.length>=12&&
    password===confirm){
  const result=await claimFirstRosevearPassword273({credential,newPassword:password});
  status=result.status==="FIRST_PASSWORD_SET_SIGNIN_AVAILABLE_MFA_AND_GRANT_STILL_REQUIRED"
   ?"ready":result.status==="OWNER_PASSWORD_ALREADY_CONFIGURED"?"already":"hold";
 }
 const url=status==="ready"?"/auth/login?status=owner-first-password":
  "/auth/owner-setup?status="+status;
 const response=NextResponse.redirect(new URL(url,request.url),303);
 response.headers.set("cache-control","no-store");
 response.headers.set("referrer-policy","no-referrer");
 return response;
}
