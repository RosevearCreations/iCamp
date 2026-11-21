import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import {
  handleSysopTelemetry,
  SYSOP_TELEMETRY_PATH,
  SYSOP_TELEMETRY_CHALLENGE_HEADER,
} from "../lib/integration-v1/sysop-telemetry-v1.mjs";

const canonical = (v) =>
  Array.isArray(v)
    ? "[" + v.map(canonical).join(",") + "]"
    : v && typeof v === "object"
      ? "{" +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
          .join(",") +
        "}"
      : JSON.stringify(v);

test("AIDP Build423 iCamp producer signs only enrolled exact-source aggregate telemetry", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const env = {
    ROSEVEAR_SYSOP_TELEMETRY_READ_TOKEN: "synthetic-token-123",
    ROSEVEAR_SYSOP_TELEMETRY_PRIVATE_KEY_PEM: privateKey.export({
      format: "pem",
      type: "pkcs8",
    }),
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
  };
  const denied = await handleSysopTelemetry({
    request: new Request("https://icamp.invalid" + SYSOP_TELEMETRY_PATH),
    env,
    appId: "icamp",
  });
  assert.equal(denied.status, 401);
  const req = new Request("https://icamp.invalid" + SYSOP_TELEMETRY_PATH, {
    headers: { "x-rosevear-telemetry-token": "synthetic-token-123" },
  });
  const res = await handleSysopTelemetry({
    request: req,
    env,
    appId: "icamp",
    nowMs: 1800000000000,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.payload.appId, "icamp");
  assert.equal(body.payload.tenantId, null);
  assert.equal(body.payload.authorizesAction, false);
  assert.equal(body.payload.sysop.bootTimeMs, null);
  assert.ok(
    verify(
      null,
      Buffer.from(canonical(body.payload)),
      publicKey,
      Buffer.from(body.signature, "hex"),
    ),
  );
});


test("AIDP Build430 iCamp signs the exact sweep challenge in protocol v1.2", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const env = {ROSEVEAR_SYSOP_TELEMETRY_READ_TOKEN:"synthetic-token-123",ROSEVEAR_SYSOP_TELEMETRY_PRIVATE_KEY_PEM:privateKey.export({format:"pem",type:"pkcs8"}),VERCEL_GIT_COMMIT_SHA:"b".repeat(40)};
  const challenge="c".repeat(64);
  const req=new Request("https://icamp.invalid"+SYSOP_TELEMETRY_PATH,{headers:{"x-rosevear-telemetry-token":"synthetic-token-123",[SYSOP_TELEMETRY_CHALLENGE_HEADER]:challenge}});
  const res=await handleSysopTelemetry({request:req,env,appId:"icamp",nowMs:1800000000000});assert.equal(res.status,200);const body=await res.json();assert.equal(body.payload.protocolVersion,"1.2");assert.equal(body.payload.challenge,challenge);assert.ok(verify(null,Buffer.from(canonical(body.payload)),publicKey,Buffer.from(body.signature,"hex")));
});

test("AIDP Build430 iCamp rejects malformed sweep challenges before signing", async () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const env={ROSEVEAR_SYSOP_TELEMETRY_READ_TOKEN:"synthetic-token-123",ROSEVEAR_SYSOP_TELEMETRY_PRIVATE_KEY_PEM:privateKey.export({format:"pem",type:"pkcs8"}),VERCEL_GIT_COMMIT_SHA:"b".repeat(40)};
  const req=new Request("https://icamp.invalid"+SYSOP_TELEMETRY_PATH,{headers:{"x-rosevear-telemetry-token":"synthetic-token-123",[SYSOP_TELEMETRY_CHALLENGE_HEADER]:"bad"}});const res=await handleSysopTelemetry({request:req,env,appId:"icamp"});assert.equal(res.status,400);const body=await res.json();assert.equal(body.state,"DENY_CHALLENGE");
});
