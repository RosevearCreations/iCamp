import {NextResponse} from "next/server";
import {acceptOriginalProof271} from "@/lib/build271/postgres.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(Number(request.headers.get("content-length")??"0")>2048)
  return NextResponse.json({accepted:false},{status:413});
 const body=await request.text();
 if(body.length>2048)return NextResponse.json({accepted:false},{status:413});
 try{
  const result=await acceptOriginalProof271(body,request.headers.get("x-icamp-source-hmac-sha256"));
  return NextResponse.json(result,{status:202});
 }catch{
  return NextResponse.json({accepted:false,status:"SOURCE_NOT_ACCEPTED"},{status:403});
 }
}
