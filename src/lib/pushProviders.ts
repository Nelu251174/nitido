import {createSign} from "node:crypto";
import http2 from "node:http2";

export type PushPlatform="IOS"|"ANDROID";
export type PushPayload={title:string;body:string;data:Record<string,string>};
export class PushProviderError extends Error{constructor(message:string,public permanent=false){super(message);}}

const b64=(value:string|Buffer)=>Buffer.from(value).toString("base64url");
function jwt(header:object,payload:object,key:string,algorithm:"RSA-SHA256"|"SHA256",p1363=false){const input=`${b64(JSON.stringify(header))}.${b64(JSON.stringify(payload))}`;const sign=createSign(algorithm);sign.update(input);sign.end();return `${input}.${sign.sign({key:key.replace(/\\n/g,"\n"),...(p1363?{dsaEncoding:"ieee-p1363" as const}:{})}).toString("base64url")}`;}

let googleToken:{value:string;expiresAt:number}|null=null;
async function firebaseAccessToken(){
  if(googleToken&&googleToken.expiresAt>Date.now()+60_000)return googleToken.value;
  const email=process.env.FIREBASE_CLIENT_EMAIL,key=process.env.FIREBASE_PRIVATE_KEY;
  if(!email||!key)throw new PushProviderError("FCM_NOT_CONFIGURED");
  const now=Math.floor(Date.now()/1000);const assertion=jwt({alg:"RS256",typ:"JWT"},{iss:email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600},key,"RSA-SHA256");
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}),signal:AbortSignal.timeout(10_000)});
  if(!response.ok)throw new PushProviderError("FCM_AUTH_FAILED");const data=await response.json() as {access_token:string;expires_in:number};googleToken={value:data.access_token,expiresAt:Date.now()+data.expires_in*1000};return data.access_token;
}

export async function sendFcm(token:string,payload:PushPayload):Promise<{providerMessageId:string}>{
  const project=process.env.FIREBASE_PROJECT_ID;if(!project)throw new PushProviderError("FCM_NOT_CONFIGURED");
  const response=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`,{method:"POST",headers:{Authorization:`Bearer ${await firebaseAccessToken()}`,"Content-Type":"application/json"},body:JSON.stringify({message:{token,notification:{title:payload.title,body:payload.body},data:payload.data,android:{priority:"high"}}}),signal:AbortSignal.timeout(10_000)});
  const text=await response.text();if(!response.ok){const permanent=response.status===404||text.includes("UNREGISTERED")||text.includes("INVALID_ARGUMENT");throw new PushProviderError(permanent?"PUSH_TOKEN_INVALID":"FCM_TEMPORARY_FAILURE",permanent);}
  const data=JSON.parse(text) as {name:string};return {providerMessageId:data.name};
}

let apnsToken:{value:string;expiresAt:number}|null=null;
function appleJwt(){if(apnsToken&&apnsToken.expiresAt>Date.now())return apnsToken.value;const keyId=process.env.APNS_KEY_ID,team=process.env.APNS_TEAM_ID,key=process.env.APNS_PRIVATE_KEY;if(!keyId||!team||!key)throw new PushProviderError("APNS_NOT_CONFIGURED");const now=Math.floor(Date.now()/1000);const value=jwt({alg:"ES256",kid:keyId},{iss:team,iat:now},key,"SHA256",true);apnsToken={value,expiresAt:Date.now()+50*60_000};return value;}

export async function sendApns(token:string,payload:PushPayload):Promise<{providerMessageId:string}>{
  const topic=process.env.APNS_BUNDLE_ID;if(!topic)throw new PushProviderError("APNS_NOT_CONFIGURED");const authority=process.env.APNS_USE_SANDBOX==="false"?"https://api.push.apple.com":"https://api.sandbox.push.apple.com";
  return new Promise((resolve,reject)=>{const client=http2.connect(authority);const timer=setTimeout(()=>{client.destroy();reject(new PushProviderError("APNS_TIMEOUT"));},10_000);client.once("error",()=>{clearTimeout(timer);reject(new PushProviderError("APNS_TEMPORARY_FAILURE"));});const req=client.request({":method":"POST",":path":`/3/device/${encodeURIComponent(token)}`,authorization:`bearer ${appleJwt()}`,"apns-topic":topic,"apns-push-type":"alert","apns-priority":"10"});let status=0,id="",body="";req.on("response",headers=>{status=Number(headers[":status"]);id=String(headers["apns-id"]??"");});req.on("data",chunk=>body+=chunk);req.on("end",()=>{clearTimeout(timer);client.close();if(status===200)resolve({providerMessageId:id});else{const permanent=status===400||status===410||body.includes("BadDeviceToken")||body.includes("Unregistered");reject(new PushProviderError(permanent?"PUSH_TOKEN_INVALID":"APNS_TEMPORARY_FAILURE",permanent));}});req.end(JSON.stringify({aps:{alert:{title:payload.title,body:payload.body},sound:"default"},...payload.data}));});
}

export async function sendPush(platform:PushPlatform,token:string,payload:PushPayload){return platform==="ANDROID"?sendFcm(token,payload):sendApns(token,payload);}
