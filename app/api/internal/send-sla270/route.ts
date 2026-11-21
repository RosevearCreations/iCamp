import { NextResponse } from "next/server";
import { dispatchOneOriginalSla270 } from "@/lib/build270/worker.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 const key=process.env.CRON_SECRET??"";
 if(key.length<32||request.headers.get("authorization")!==`Bearer ${key}`)
  return NextResponse.json({status:"UNAUTHORIZED"},{status:401});
 try{
  const result=await dispatchOneOriginalSla270();
  const active=result.status==="PROVIDER_ACCEPTED_NOT_DELIVERED"||
   result.status==="NO_UNSENT_ORIGINAL_SLA";
  return NextResponse.json(result,{status:active?202:503});
 }catch{
  return NextResponse.json({status:"HOLD_OUTBOUND_SOURCE"},{status:503});
 }
}
