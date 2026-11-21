import { NextResponse } from "next/server";
import { acceptTraffic269 } from "@/lib/campground-pilot269/postgres.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(Number(request.headers.get("content-length")??"0")>2048)
  return NextResponse.json({accepted:false},{status:413});
 const body=await request.text();
 if(body.length>2048)return NextResponse.json({accepted:false},{status:413});
 try{
  await acceptTraffic269(body,request.headers.get("x-icamp-traffic-signature"));
  return NextResponse.json({accepted:true},{status:202});
 }catch{
  return NextResponse.json({accepted:false,status:"SOURCE_NOT_ACCEPTED"},{status:403});
 }
}
