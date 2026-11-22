import {NextResponse} from "next/server";
import {acceptRestoreProvider273} from "@/lib/build273/postgres.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(Number(request.headers.get("content-length")??"0")>3500)
  return NextResponse.json({accepted:false},{status:413,headers:{"cache-control":"no-store"}});
 const body=await request.text();
 if(body.length>3500)return NextResponse.json({accepted:false},{status:413});
 try{
  const result=await acceptRestoreProvider273(body,
   request.headers.get("x-icamp-hmac-sha256"));
  return NextResponse.json(result,{status:202,headers:{"cache-control":"no-store"}});
 }catch{
  return NextResponse.json({accepted:false,status:"NOT_ACCEPTED"},
   {status:403,headers:{"cache-control":"no-store"}});
 }
}
