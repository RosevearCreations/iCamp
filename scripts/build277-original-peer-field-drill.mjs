#!/usr/bin/env node
// Original field drill. Run only from the original peer repository with its enrolled key.
// Never creates keys, prints signing material or simulates a source identity.
import { readFile } from "node:fs/promises";
import { createPrivateKey, randomBytes, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { SOURCES275 } from "../lib/build275/diagnostics.mjs";

const source=process.env.ICAMP_277_SOURCE_ID??"";
const keyId=process.env.ICAMP_277_KEY_ID??"";
const keyPath=process.env.ICAMP_277_PRIVATE_KEY_PATH??"";
const commitSha=process.env.ICAMP_277_APPROVED_COMMIT_SHA??"";
const receiver="https://i-camp-pi.vercel.app";
const validId=/^[a-z0-9_-]{8,80}$/u;
const validCommit=/^[a-f0-9]{40}$/u;

if (!SOURCES275.includes(source) || !validId.test(keyId) ||
    !validCommit.test(commitSha) || !keyPath.trim()) {
  console.error("HOLD: original source identity, approved revision or key path missing.");
  process.exitCode=2;
} else {
  let gitSha="";
  try {
    gitSha=execFileSync("git",["rev-parse","HEAD"],{
      cwd:process.cwd(),encoding:"utf8",timeout:2000,
      windowsHide:true,stdio:["ignore","pipe","ignore"]}).trim();
  } catch {
    console.error("HOLD: run from the original peer source repository.");
    process.exit(2);
  }
  if (gitSha!==commitSha) {
    console.error("HOLD: source HEAD differs from owner-approved source revision.");
    process.exit(2);
  }
  const key=createPrivateKey(await readFile(keyPath));
  if (key.asymmetricKeyType!=="ed25519") {
    console.error("HOLD: original enrolled key must use Ed25519.");
    process.exit(2);
  }
  const signedBody=challengeId=>JSON.stringify({
    source,keyId,commitSha,challengeId,
    nonce:randomBytes(24).toString("base64url"),
    observedAt:new Date().toISOString(),
  });
  async function post(path,body) {
    const signature=sign(null,Buffer.from(body,"utf8"),key).toString("base64url");
    const response=await fetch(receiver+path,{
      method:"POST",redirect:"error",signal:AbortSignal.timeout(12000),
      headers:{
        "content-type":"application/json",
        "x-icamp-ed25519-signature":signature,
        "cache-control":"no-store",
      },body,
    });
    if(response.status!==202)throw Error("RECEIVER_REJECTED_"+response.status);
    const text=await response.text();
    if(text.length>1024)throw Error("OVERSIZE_RECEIVER_RESPONSE");
    return JSON.parse(text);
  }
  const request=await post("/api/internal/peer-challenge277",
    signedBody(randomBytes(24).toString("base64url")));
  if (!/^[A-Za-z0-9_-]{16,96}$/u.test(request.challengeId??"") ||
      request.source!==source || Date.parse(request.expiresAt)<=Date.now())
    throw Error("INVALID_RECEIVER_CHALLENGE");
  const receipt=await post("/api/internal/peer-response277",
    signedBody(request.challengeId));
  if(receipt.accepted!==true)throw Error("RESPONSE_NOT_ACCEPTED");
  console.log("ORIGINAL_FIELD_CHALLENGE_ACCEPTED_NOT_EXTERNALLY_CERTIFIED");
  console.log("Source:",source,"Source Git HEAD:",gitSha);
  console.log("Review /sysop/acceptance277 within five minutes.");
}
