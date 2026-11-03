/**
 * Read-only diagnosis. No send, resend, confirmation, account or configuration mutation.
 * Fixture: node scripts/email-diagnostics-readonly.mjs --fixture ./sanitized-fixture.json
 * Runtime: node scripts/email-diagnostics-readonly.mjs --database /app/data/nitido.db --user-id <opaque-id>
 * Optional --provider-domains / --provider-events read only existing provider metadata, never email bodies.
 * An accepted message or a verified sender domain does NOT establish Gmail delivery.
 */
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const id=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)?value:null;
const stages=new Set(['configuration','site','verification','provider','transport']);
const categories=new Set(['not_configured','invalid_sender','invalid_site','token_issue_failed','verification_busy','provider_accepted','provider_unauthorized','provider_forbidden','provider_rate_limited','provider_unavailable','provider_rejected','transport_timeout','transport_error']);
function timestamp(value){if(typeof value!=='number'&&typeof value!=='string')return null;const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString():null}
export function redactEmailMetadata(input){
 const rows=Array.isArray(input?.records)?input.records.slice(0,100).map(row=>row&&typeof row==='object'&&!Array.isArray(row)?row:{}):[];
 return {readOnly:true,realMessagesSent:0,deliveryConfirmed:false,configuration:{
  keyPresent:input?.configuration?.keyPresent===true,senderPresent:input?.configuration?.senderPresent===true,siteHttps:input?.configuration?.siteHttps===true,
 },records:rows.map(row=>({
  correlationId:id(row.correlationId??row.correlation_id),createdAt:timestamp(row.createdAt??row.created_at),
  stage:stages.has(row.stage)?row.stage:'unknown',category:categories.has(row.category)?row.category:'unknown',
  httpStatus:Number.isInteger(row.httpStatus??row.http_status)&&(row.httpStatus??row.http_status)>=100&&(row.httpStatus??row.http_status)<=599?(row.httpStatus??row.http_status):null,
  messageId:id(row.messageId??row.provider_message_id),accepted:row.accepted===true||row.accepted===1,
  attempts:Number.isInteger(row.attempts)&&row.attempts>=0&&row.attempts<=2?row.attempts:null,
 }))};
}
/** Existing account/link metadata is useful even before the new diagnostic table is deployed.
 * Queries return booleans, roles and expiry only: never the address, verification hash or token. */
export function accountVerificationMetadata(db,userId,now=Date.now()){
 const columns=name=>new Set(db.prepare(`PRAGMA table_info(${name})`).all().map(row=>row.name));
 const users=columns('users'),verification=columns('email_verifications'),removed=columns('admin_removed_accounts'),leases=columns('email_verification_send_leases');
 const schemaAvailable=['id','role','email'].every(name=>users.has(name));
 const verificationSchemaAvailable=['user_id','email','token_hash','expires_at','verified_at'].every(name=>verification.has(name));
 const output={schemaAvailable,verificationSchemaAvailable,accountExists:null,active:null,role:null,emailPresent:null,verificationRecordPresent:null,currentAddressMatches:null,verified:null,linkState:'unknown',linkExpiresAt:null,sendLeaseActive:null};
 if(!schemaAvailable)return output;
 const user=db.prepare('SELECT role,CASE WHEN email IS NOT NULL AND length(trim(email))>0 THEN 1 ELSE 0 END email_present FROM users WHERE id=?').get(userId);
 output.accountExists=Boolean(user);
 if(!user){output.linkState='account_missing';return output;}
 output.role=['client','firma'].includes(user.role)?user.role:null;output.emailPresent=user.email_present===1;
 output.active=!removed.has('user_id')||!db.prepare('SELECT 1 FROM admin_removed_accounts WHERE user_id=?').get(userId);
 if(['user_id','expires_at'].every(name=>leases.has(name)))output.sendLeaseActive=Boolean(db.prepare('SELECT 1 FROM email_verification_send_leases WHERE user_id=? AND expires_at>?').get(userId,now));
 if(!output.active){output.verified=false;output.linkState='account_inactive';return output;}
 if(!verificationSchemaAvailable){output.linkState='verification_schema_unavailable';return output;}
 const row=db.prepare(`SELECT CASE WHEN v.email=u.email THEN 1 ELSE 0 END address_matches,
  CASE WHEN v.verified_at IS NOT NULL THEN 1 ELSE 0 END confirmed,
  CASE WHEN v.token_hash IS NOT NULL THEN 1 ELSE 0 END token_present,v.expires_at
  FROM email_verifications v JOIN users u ON u.id=v.user_id WHERE v.user_id=?`).get(userId);
 output.verificationRecordPresent=Boolean(row);output.verified=false;
 if(!row){output.linkState='not_issued';return output;}
 output.currentAddressMatches=row.address_matches===1;
 if(!output.currentAddressMatches){output.linkState='address_changed';return output;}
 if(row.confirmed===1){output.verified=true;output.linkState='confirmed';return output;}
 if(row.token_present!==1){output.linkState='not_issued';return output;}
 output.linkExpiresAt=timestamp(row.expires_at);
 output.linkState=typeof row.expires_at==='number'&&Number.isFinite(row.expires_at)?(row.expires_at>now?'valid_unexpired':'expired'):'expiry_unavailable';
 return output;
}
export async function senderDomainReadOnly(env,transport=fetch){
 if(!env.RESEND_API_KEY||!env.RESEND_FROM)return {available:false,reason:'not_configured'};
 const domain=(env.RESEND_FROM.match(/@([A-Za-z0-9.-]+)/)?.[1]??'').toLowerCase();
 if(!domain)return {available:false,reason:'invalid_sender'};
 try{
  const response=await transport('https://api.resend.com/domains',{method:'GET',redirect:'error',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return {available:false,httpStatus:response.status,reason:[401,403].includes(response.status)?'read_permission_unavailable':'provider_read_unavailable'};
  const body=await response.json();if(!Array.isArray(body?.data))return {available:false,httpStatus:response.status,reason:'provider_metadata_unavailable'};
  const match=body.data.find(row=>row&&typeof row==='object'&&row.name===domain);
  const allowed=new Set(['verified','pending','failed','not_started','temporary_failure']);
  return {available:true,httpStatus:response.status,senderDomainMatched:Boolean(match),status:match&&allowed.has(match.status)?match.status:null};
 }catch{return {available:false,reason:'provider_transport_unavailable'}}
}
export async function existingEmailEventsReadOnly(env,messageIds,transport=fetch){
 const wanted=new Set(messageIds.map(id).filter(Boolean)),matches=[];
 if(!wanted.size)return {available:false,reason:'no_provider_message_ids',records:[],inboxReceptionVerified:false};
 if(!env.RESEND_API_KEY)return {available:false,reason:'not_configured',records:[],inboxReceptionVerified:false};
 const allowed=new Set(['sent','delivered','delivery_delayed','bounced','complained','failed','queued','scheduled','suppressed','opened','clicked']);
 const signal=AbortSignal.timeout(8000);let cursor=null,hasMore=false;
 try{
  for(let page=0;page<3;page++){
   const endpoint='https://api.resend.com/emails?limit=100'+(cursor?'&after='+encodeURIComponent(cursor):'');
   const response=await transport(endpoint,{method:'GET',redirect:'error',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`},signal});
   if(!response.ok)return {available:false,httpStatus:response.status,reason:[401,403].includes(response.status)?'read_permission_unavailable':'provider_read_unavailable',records:matches,inboxReceptionVerified:false};
   const body=await response.json();if(!Array.isArray(body?.data))return {available:false,reason:'provider_metadata_unavailable',records:matches,inboxReceptionVerified:false};
   const rows=body.data;hasMore=body?.has_more!==false;
   for(const row of rows){
    if(!row||typeof row!=='object')continue;
    const messageId=id(row.id);if(!messageId||!wanted.has(messageId)||matches.some(m=>m.messageId===messageId))continue;
    const event=typeof row.last_event==='string'?row.last_event.replace(/^email\./,''):null;
    matches.push({messageId,event:allowed.has(event)?event:null,createdAt:timestamp(row.created_at)});
   }
   if(!hasMore||matches.length===wanted.size)break;
   cursor=id(rows.at(-1)?.id);if(!cursor)break;
  }
  return {available:true,records:matches,searchTruncated:hasMore&&matches.length<wanted.size,providerDeliveryReported:matches.some(row=>row.event==='delivered'),inboxReceptionVerified:false};
 }catch{return {available:false,reason:'provider_transport_unavailable',records:matches,inboxReceptionVerified:false}}
}
export async function runEmailDiagnosis(args,{env=process.env,transport=fetch}={}){
 const value=flag=>{const at=args.indexOf(flag);return at>=0?args[at+1]:undefined};
 const fixture=value('--fixture');
 if(fixture){
  if(args.includes('--provider-domains')||args.includes('--provider-events'))throw Error('FIXTURE_NETWORK_NOT_ALLOWED');
  return {...redactEmailMetadata(JSON.parse(readFileSync(fixture,'utf8'))),evidence:'isolated_fixture_not_live'};
 }
 const database=value('--database'),userId=value('--user-id');
 if(!database||!userId||!/^[A-Za-z0-9_-]{1,128}$/.test(userId))throw Error('DATABASE_AND_OPAQUE_USER_ID_REQUIRED');
 const Database=require('better-sqlite3'),db=new Database(database,{readonly:true,fileMustExist:true});
 let records=[],schemaAvailable=false,accountState=null;
 try{
  accountState=accountVerificationMetadata(db,userId);
  schemaAvailable=Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='email_delivery_diagnostics'").get());
  if(schemaAvailable)records=db.prepare('SELECT correlation_id,created_at,stage,category,http_status,provider_message_id,accepted,attempts FROM email_delivery_diagnostics WHERE user_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 100').all(userId,Date.now()-30*86400000);
 }finally{db.close()}
 let siteHttps=false;try{const site=new URL(env.NEXT_PUBLIC_SITE_URL??'');siteHttps=site.protocol==='https:'&&!site.username&&!site.password}catch{/* Report a boolean only. */}
 const output={...redactEmailMetadata({configuration:{keyPresent:Boolean(env.RESEND_API_KEY),senderPresent:Boolean(env.RESEND_FROM),siteHttps},records}),evidence:'existing_runtime_metadata_only',schemaAvailable,accountState};
 if(args.includes('--provider-domains'))output.senderDomain=await senderDomainReadOnly(env,transport);
 if(args.includes('--provider-events'))output.existingProviderEvents=await existingEmailEventsReadOnly(env,records.map(row=>row.provider_message_id),transport);
 return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 runEmailDiagnosis(process.argv.slice(2)).then(output=>console.log(JSON.stringify(output))).catch(()=>{console.log(JSON.stringify({readOnly:true,realMessagesSent:0,deliveryConfirmed:false,error:'EMAIL_DIAGNOSIS_UNAVAILABLE'}));process.exitCode=1});
}
