// Owner-approved, fixed recipients only. No general queues or financial actions.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const CANDIDATES=[['firm_gss3cxi4mv1cy43e','ALLSTONES BUSINESS SRL'],['firm_z5w23tk7mv9hrpea','Jami curatenie Cta']];
const ACTIONS=['ios','android','mail'];
const MARKER='NITIDO_PILOT_20261024_V1';
const ROOT='/app/data/pilot-20261024';
const providers=(()=>{const module={exports:{}};const exports=module.exports;
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushProviderError = void 0;
exports.pushPlatformConfigured = pushPlatformConfigured;
exports.sendFcm = sendFcm;
exports.sendApns = sendApns;
exports.sendPush = sendPush;
const node_crypto_1 = require("node:crypto");
const node_http2_1 = __importDefault(require("node:http2"));
class PushProviderError extends Error {
    permanent;
    constructor(message, permanent = false) {
        super(message);
        this.permanent = permanent;
    }
}
exports.PushProviderError = PushProviderError;
function pushPlatformConfigured(platform, env = process.env) {
    const keys = platform === "ANDROID" ? ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"] : ["APNS_KEY_ID", "APNS_TEAM_ID", "APNS_PRIVATE_KEY"];
    return keys.every(k => Boolean(env[k]?.trim())) && (platform === "ANDROID" || env.APNS_BUNDLE_ID === "ro.nitido.app" && ["true", "false"].includes(env.APNS_USE_SANDBOX ?? ""));
}
const b64 = (value) => Buffer.from(value).toString("base64url");
function jwt(header, payload, key, algorithm, p1363 = false) { const input = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(payload))}`; const sign = (0, node_crypto_1.createSign)(algorithm); sign.update(input); sign.end(); return `${input}.${sign.sign({ key: key.replace(/\\n/g, "\n"), ...(p1363 ? { dsaEncoding: "ieee-p1363" } : {}) }).toString("base64url")}`; }
let googleToken = null;
async function firebaseAccessToken() {
    if (googleToken && googleToken.expiresAt > Date.now() + 60_000)
        return googleToken.value;
    const email = process.env.FIREBASE_CLIENT_EMAIL, key = process.env.FIREBASE_PRIVATE_KEY;
    if (!email || !key)
        throw new PushProviderError("FCM_NOT_CONFIGURED");
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt({ alg: "RS256", typ: "JWT" }, { iss: email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, key, "RSA-SHA256");
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok)
        throw new PushProviderError("FCM_AUTH_FAILED");
    const data = await response.json();
    googleToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
}
async function sendFcm(token, payload) {
    const project = process.env.FIREBASE_PROJECT_ID;
    if (!project)
        throw new PushProviderError("FCM_NOT_CONFIGURED");
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`, { method: "POST", headers: { Authorization: `Bearer ${await firebaseAccessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token, notification: { title: payload.title, body: payload.body }, data: payload.data, android: { priority: "high", notification: { sound: "default", channel_id: payload.data.event_type === "MESSAGE_RECEIVED" ? "messages-v1" : "activity-v1", tag: payload.data.message_id } } } }), signal: AbortSignal.timeout(10_000) });
    let data;
    try {
        data = await response.json();
    }
    catch {
        throw new PushProviderError("FCM_TEMPORARY_FAILURE");
    }
    if (!response.ok) {
        const permanent = Array.isArray(data.error?.details) && data.error.details.some(detail => detail.errorCode === "UNREGISTERED") === true;
        throw new PushProviderError(permanent ? "PUSH_TOKEN_INVALID" : "FCM_TEMPORARY_FAILURE", permanent);
    }
    if (typeof data.name !== "string" || !data.name.startsWith(`projects/${project}/messages/`))
        throw new PushProviderError("FCM_TEMPORARY_FAILURE");
    return { providerMessageId: data.name };
}
let apnsToken = null;
function appleJwt() { if (apnsToken && apnsToken.expiresAt > Date.now())
    return apnsToken.value; const keyId = process.env.APNS_KEY_ID, team = process.env.APNS_TEAM_ID, key = process.env.APNS_PRIVATE_KEY; if (!keyId || !team || !key)
    throw new PushProviderError("APNS_NOT_CONFIGURED"); const now = Math.floor(Date.now() / 1000); const value = jwt({ alg: "ES256", kid: keyId }, { iss: team, iat: now }, key, "SHA256", true); apnsToken = { value, expiresAt: Date.now() + 50 * 60_000 }; return value; }
async function sendApns(token, payload) {
    const topic = process.env.APNS_BUNDLE_ID, mode = process.env.APNS_USE_SANDBOX;
    if (topic !== "ro.nitido.app" || !["true", "false"].includes(mode ?? ""))
        throw new PushProviderError("APNS_NOT_CONFIGURED");
    // Validate credentials before opening a connection; a missing key must not leak sockets.
    const authorization = `bearer ${appleJwt()}`;
    const authority = mode === "false" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
    return new Promise((resolve, reject) => {
        const client = node_http2_1.default.connect(authority);
        let settled = false;
        let req;
        const finish = (error, providerMessageId) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (error) {
                req?.destroy();
                client.destroy();
                reject(error);
            }
            else {
                client.close();
                resolve({ providerMessageId: providerMessageId });
            }
        };
        const timer = setTimeout(() => finish(new PushProviderError("APNS_TIMEOUT")), 10_000);
        client.once("error", () => finish(new PushProviderError("APNS_TEMPORARY_FAILURE")));
        try {
            req = client.request({ ":method": "POST", ":path": `/3/device/${encodeURIComponent(token)}`, authorization, "apns-topic": topic, "apns-push-type": "alert", "apns-priority": "10" });
            let status = 0, id = "", body = "";
            req.on("response", headers => { status = Number(headers[":status"]); id = String(headers["apns-id"] ?? ""); });
            req.on("data", chunk => { body += chunk; if (body.length > 8192)
                finish(new PushProviderError("APNS_TEMPORARY_FAILURE")); });
            req.once("error", () => finish(new PushProviderError("APNS_TEMPORARY_FAILURE")));
            req.once("aborted", () => finish(new PushProviderError("APNS_TEMPORARY_FAILURE")));
            req.on("end", () => {
                if (status === 200 && id)
                    return finish(undefined, id);
                let reason = "";
                try {
                    reason = JSON.parse(body).reason;
                }
                catch { }
                const permanent = reason === "Unregistered" || reason === "BadDeviceToken";
                finish(new PushProviderError(permanent ? "PUSH_TOKEN_INVALID" : "APNS_TEMPORARY_FAILURE", permanent));
            });
            req.end(JSON.stringify({ ...payload.data, aps: { alert: { title: payload.title, body: payload.body }, sound: "default" } }));
        }
        catch {
            finish(new PushProviderError("APNS_TEMPORARY_FAILURE"));
        }
    });
}
async function sendPush(platform, token, payload) { return platform === "ANDROID" ? sendFcm(token, payload) : sendApns(token, payload); }

return module.exports;})();
const subject='NÍTIDO — confirmare participare pilot Constanța';
const text='Bună ziua,\n\nPregătim pilotul NÍTIDO în Constanța, cu disponibilitate confirmată de fiecare firmă.\n\nVă rugăm să confirmați:\n1. Participarea firmei și persoana care coordonează lucrările.\n2. Serviciile pe care le puteți executa și zonele acoperite.\n3. Echipa disponibilă și intervalele exacte din următoarele șapte zile, cu timpul necesar deplasării.\n4. Numărul de lucrări pe care le puteți prelua în aceste intervale, ținând cont de programările deja asumate.\n\nOrganizarea personalului aparține firmei. Participarea la pilot nu garantează un volum de comenzi și nu modifică tarifele sau comisionul existent. Fiecare lucrare urmează confirmările din platformă.\n\nDupă confirmare, stabilim primul interval potrivit pentru verificare și activare în NÍTIDO.\n\nMulțumim,\nEchipa NÍTIDO';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const html='<div style="white-space:pre-line">'+escape(text)+'</div>';
function output(value){const line=JSON.stringify({marker:MARKER,...value});console.log(line);try{fs.appendFileSync('/proc/1/fd/1',line+'\n')}catch{}}
function save(file,value){fs.writeFileSync(file+'.tmp',JSON.stringify(value)+'\n',{mode:0o600});fs.renameSync(file+'.tmp',file)}
async function once(key,send,{root=ROOT,now=()=>Date.now()}={}){
 fs.mkdirSync(root,{recursive:true,mode:0o700});const file=path.join(root,key+'.json'),lock=file+'.lock';
 const fd=fs.openSync(lock,'wx',0o600);
 try{
  if(fs.existsSync(file)){
   const old=JSON.parse(fs.readFileSync(file,'utf8'));
   if(old.status==='provider_accepted')return {status:old.status,reused:true};
   return {status:'uncertain_no_automatic_retry',reused:true};
  }
  const row={status:'dispatching',createdAt:new Date(now()).toISOString()};save(file,row);
  try{const id=await send();if(typeof id!=='string'||!id)throw Error('PROVIDER_RESULT_UNKNOWN');save(file,{...row,status:'provider_accepted',providerMessageId:id});return {status:'provider_accepted',reused:false}}
  catch{save(file,{...row,status:'rejected_or_unknown'});return {status:'rejected_or_unknown',reused:false}}
 }finally{fs.closeSync(fd);fs.unlinkSync(lock)}
}
function recipient(db,id,name){
 const r=db.prepare('SELECT u.id,u.role,u.name,u.email,EXISTS(SELECT 1 FROM email_verifications v WHERE v.user_id=u.id AND v.email=u.email AND v.verified_at IS NOT NULL) email_verified FROM firms f JOIN users u ON u.id=f.user_id WHERE f.id=?').get(id);
 if(!r||r.role!=='firma'||r.name!==name)throw Error('FIRM_IDENTITY_MISMATCH');
 if(typeof r.email!=='string'||!/^\S+@[^\s@]+\.[^\s@]+$/.test(r.email)||!r.email_verified)throw Error('CONTACT_CHANNEL_NOT_VERIFIED');
 return r.email;
}
function device(db,platform,now=Date.now()){
 const u=db.prepare('SELECT id,role FROM users WHERE lower(email)=?').get('support@nitido.ro');
 if(!u||u.role!=='client')throw Error('TEST_ACCOUNT_MISMATCH');
 const ds=db.prepare('SELECT id,device_token,last_seen_at,updated_at FROM push_devices WHERE user_id=? AND platform=? AND push_enabled=1 AND revoked_at IS NULL ORDER BY updated_at DESC LIMIT 2').all(u.id,platform);
 if(ds.length!==1)throw Error('EXACTLY_ONE_ACTIVE_TEST_DEVICE_REQUIRED');
 const d=ds[0],raw=String(d.last_seen_at??d.updated_at),seen=Date.parse(raw.includes('T')?raw:raw.replace(' ','T')+'Z');
 if(!Number.isFinite(seen)||seen>now+300000||now-seen>72*3600000)throw Error('TEST_DEVICE_NOT_RECENT');
 if(typeof d.device_token!=='string'||(platform==='IOS'?!/^[a-f\d]{64}$/i.test(d.device_token):d.device_token.length<20))throw Error('TEST_DEVICE_INVALID');
 return d;
}
async function execute(action,{env=process.env,db,sendPush=providers.sendPush,fetcher=fetch,onceFn=once}={}){
 if(!ACTIONS.includes(action)||env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro')throw Error('TARGET_MISMATCH');
 if(action==='mail'){
  if(!env.RESEND_API_KEY||!env.RESEND_FROM)throw Error('MAIL_NOT_CONFIGURED');
  const results=[];
  for(const [id,name] of CANDIDATES){
   try{
    const to=recipient(db,id,name);
    const result=await onceFn('firm-'+id,async()=>{
     const r=await fetcher('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'nitido-pilot-20261024-'+id},body:JSON.stringify({from:env.RESEND_FROM,to:[to],subject,html})});
     if(!r.ok)throw Error('MAIL_PROVIDER_REJECTED');const body=await r.json();return body.id;
    });results.push({firmId:id,...result});
   }catch(e){results.push({firmId:id,status:'blocked',reason:['FIRM_IDENTITY_MISMATCH','CONTACT_CHANNEL_NOT_VERIFIED'].includes(e.message)?e.message:'MAIL_UNAVAILABLE'})}
  }
  return {action,results,messagesAccepted:results.filter(x=>x.status==='provider_accepted').length,deliveryConfirmed:false};
 }
 const platform=action==='ios'?'IOS':'ANDROID';
 if(!providers.pushPlatformConfigured(platform,env)||platform==='IOS'&&env.APNS_USE_SANDBOX!=='false'||platform==='ANDROID'&&env.FIREBASE_PROJECT_ID!=='nitido-508720')throw Error('PUSH_PROVIDER_NOT_CONFIGURED');
 const d=device(db,platform),id='owner-test-20261024-'+action;
 const result=await onceFn(id,async()=>{
  if(!db.prepare('SELECT 1 FROM push_devices WHERE id=? AND push_enabled=1 AND revoked_at IS NULL AND device_token=?').get(d.id,d.device_token))throw Error('TEST_DEVICE_REVOKED');
  const sent=await sendPush(platform,d.device_token,{title:'Test notificare NÍTIDO',body:'Test pentru '+(platform==='IOS'?'iPhone':'Android')+' cu sunetul standard al telefonului.',data:{event_type:'NITIDO_CONFIG_TEST',test_id:id,message_id:id,url:'/client'}});return sent.providerMessageId;
 });return {action,...result,sound:'default',deviceReceptionConfirmed:false};
}
module.exports={execute,once,recipient,device,CANDIDATES,text,subject};
if(ACTIONS.includes(process.argv[1])){
 const Database=require('better-sqlite3');const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
 execute(process.argv[1],{db}).then(result=>{output(result);if(result.status&&result.status!=='provider_accepted'||result.results?.some(r=>r.status!=='provider_accepted'))process.exitCode=2}).catch(e=>{output({action:process.argv[1],status:'blocked',reason:/^[A-Z_]+$/.test(e.message)?e.message:'OPERATION_UNAVAILABLE'});process.exitCode=1}).finally(()=>db.close());
}
