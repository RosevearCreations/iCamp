export const SIGNED_SOURCES277: readonly string[];
export const RECEIPT_ID277: RegExp;
export function originalHostPin277(databaseUrl:string|undefined,
 expectedHost:string|undefined):{configured:boolean;pinned:boolean;status:string};
export function validateOwnerPin277(input:{
 proposalId:string;evidenceDigest:string;ownerSessionId:string;ownerUserId:string;
 ownerUsername:string;assuranceLevel:string;
}):{
 proposalId:string;evidenceDigest:string;ownerSessionId:string;ownerUserId:string;
 ownerUsername:string;assuranceLevel:string;
};
export interface IssuedChallenge277 {
 challengeId:string;source:string;keyId:string;commitSha:string;
 requestNonce:string;issuedAt:number;expiresAt:number;
}
export function verifyFieldResponse277(input:{
 body:string;signature:string; pins:Record<string,{keyId:string;commitSha:string;publicKeyPem:string}>;
 issued:IssuedChallenge277;now?:number;
}):{
 source:string;keyId:string;commitSha:string;challengeId:string;nonce:string;
 observedAt:string;body:string;signature:string;digest:string;
};
export interface FieldRow277 {
 source_id:string;key_id:string;commit_sha:string;challenge_id:string;
 request_nonce:string;issued_at:string;expires_at:string;accepted_at:string;
 signed_body:string;signature_b64url:string;body_sha256:string;
}
export function classifyFieldReadback277(rows:FieldRow277[],
 pins:Record<string,{keyId:string;commitSha:string;publicKeyPem:string}>,
 now?:number):{checks:{source:string;status:string}[];count:number;status:string};
export function classifyExternalRestore277(
 original:boolean,external:boolean,readbackVerified:boolean
):{status:string;actualRestoreExecuted:boolean};
export function closure277(input:{
 host:{pinned:boolean};owner:{status:string};peer:{count:number};
 restore:{status:string};
}):{status:string;productionRestored:boolean};
export function digest277(raw:string):string;
