import {hashPassword,validatePassword} from "../auth/crypto.mjs";
import {originalPool270} from "../build270/postgres.mjs";
import {verifyOneTimeCredential273,ownerSetupReadiness273} from "./core.mjs";
// Only the original Rosevear account can be given a first password.
// The secret is deployed exclusively in Vercel production, is never logged,
// expires and cannot overwrite an existing password. It cannot grant Sysop.
export async function claimFirstRosevearPassword273({credential,newPassword}){
 if(!validatePassword(newPassword).ok)return {status:"HOLD_PASSWORD_POLICY"};
 if(!verifyOneTimeCredential273({
  supplied:credential,
  configured:process.env.ICAMP_OWNER273_FIRST_LOGIN_SECRET,
  expiresAt:process.env.ICAMP_OWNER273_FIRST_LOGIN_EXPIRES_AT,
  environment:process.env.VERCEL_ENV,
 }))return {status:"HOLD_INVALID_OR_EXPIRED_RECOVERY_CREDENTIAL"};
 if(!process.env.DATABASE_URL?.trim())return {status:"HOLD_ORIGINAL_DATABASE"};
 const hash=await hashPassword(newPassword);
 const client=await originalPool270().connect();
 try{
  await client.query("begin");
  await client.query("set local statement_timeout='8000ms'");
  const q=await client.query(
   "select a.id,a.account_type,a.account_state,a.archived_at,a.mfa_required,"+
   "exists(select 1 from icamp_private.password_credentials p where p.user_id=a.id) as existing "+
   "from icamp_private.user_accounts a where a.username_normalized=$1 for update of a",
   ["rosevear"]);
  const owner=q.rows[0];
  const readiness=ownerSetupReadiness273({
   originalAccount:q.rowCount===1,accountType:owner?.account_type,
   archived:Boolean(owner?.archived_at),existingCredential:owner?.existing,
   mfaRequired:owner?.mfa_required
  });
  if(readiness!=="ELIGIBLE_FIRST_PASSWORD_ONE_TIME_CLAIM"){
   await client.query("rollback");
   return {status:readiness};
  }
  const inserted=await client.query(
   "insert into icamp_private.password_credentials(user_id,password_hash) "+
   "values($1,$2) on conflict do nothing returning user_id",[owner.id,hash]);
  if(inserted.rowCount!==1)throw Error("ORIGINAL_PASSWORD_CLAIM_RACE");
  const activated=await client.query(
   "update icamp_private.user_accounts "+
   "set account_state='active',failed_sign_in_count=0,locked_until=null "+
   "where id=$1 and account_type='staff' and archived_at is null "+
   "and username_normalized='rosevear' returning id",[owner.id]);
  if(activated.rowCount!==1)throw Error("ORIGINAL_ROSEVEAR_ACTIVATION_REJECTED");
  await client.query(
   "update icamp_private.auth_sessions set revoked_at=statement_timestamp(),"+
   "revoke_reason='owner-first-password-273' "+
   "where user_id=$1 and revoked_at is null",[owner.id]);
  await client.query("commit");
  return {status:"FIRST_PASSWORD_SET_SIGNIN_AVAILABLE_MFA_AND_GRANT_STILL_REQUIRED"};
 }catch{
  await client.query("rollback").catch(()=>{});
  return {status:"HOLD_ORIGINAL_SETUP_FAILED"};
 }finally{client.release();}
}
