// Submit the prepared update to Apple review. Public release remains manual.
// Existing review credentials stay in memory and are used only for NITIDO login.
import fs from 'node:fs/promises';
import {createPrivateKey,sign} from 'node:crypto';
const app='6810752486',version='08a7aa99-6eca-4659-ae8a-637dd632e05d',build='6001e27d-9cbd-45ac-b75d-3db441e0322c';
const proof={checkedAt:new Date().toISOString(),appId:app,version:'1.0.3',build:20,buildId:build,versionId:version,appReviewSubmitted:false,publicRelease:false,betaTestersOrGroupsChanged:false,credentialsExported:false};
const key=createPrivateKey(process.env.ASC_PRIVATE_KEY.replace(/\\n/g,'\n'));
async function api(path,method='GET',data,allowMissing=false){
 const now=Math.floor(Date.now()/1000),b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const input=b({alg:'ES256',kid:process.env.ASC_KEY_ID,typ:'JWT'})+'.'+b({iss:process.env.ASC_ISSUER_ID,iat:now,exp:now+300,aud:'appstoreconnect-v1'});
 const jwt=input+'.'+sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const r=await fetch('https://api.appstoreconnect.apple.com'+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:data?JSON.stringify({data}):undefined});
 if(allowMissing&&r.status===404)return null;
 if(!r.ok){const e=await r.json().catch(()=>({}));proof.appleErrors=(e.errors??[]).map(x=>({code:x.code,status:x.status}));throw Error('ASC_HTTP_'+r.status);}
 return r.status===204?{}:r.json();
}
try{
 const health=await fetch('https://nitido.ro/api/health',{redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!health.ok||(await health.json()).status!=='ok')throw Error('LIVE_NOT_HEALTHY');
 const appData=(await api('/v1/apps/'+app)).data;
 if(appData.attributes.bundleId!=='ro.nitido.app')throw Error('APP_IDENTITY_MISMATCH');
 const v=(await api('/v1/appStoreVersions/'+version+'?include=build')).data;
 if(v.attributes.versionString!=='1.0.3'||v.attributes.releaseType!=='MANUAL'||v.relationships?.build?.data?.id!==build)throw Error('VERSION_OR_MANUAL_RELEASE_GUARD_FAILED');
 proof.manualPublicRelease=true;
 if(['WAITING_FOR_REVIEW','IN_REVIEW','PENDING_DEVELOPER_RELEASE','READY_FOR_SALE'].includes(v.attributes.appStoreState)){
  proof.appReviewSubmitted=true;proof.state=v.attributes.appStoreState;proof.publicRelease=v.attributes.appStoreState==='READY_FOR_SALE';
 }else{
  if(v.attributes.appStoreState!=='PREPARE_FOR_SUBMISSION')throw Error('VERSION_NOT_PREPARED');
  const b=(await api('/v1/builds/'+build)).data;
  if(b.attributes.version!=='20'||b.attributes.processingState!=='VALID')throw Error('BUILD_NOT_VALID');
  // The signed IPA explicitly declares ITSAppUsesNonExemptEncryption=false.
  if(b.attributes.usesNonExemptEncryption==null)await api('/v1/builds/'+build,'PATCH',{type:'builds',id:build,attributes:{usesNonExemptEncryption:false}});
  const locales=(await api('/v1/appStoreVersions/'+version+'/appStoreVersionLocalizations?limit=200')).data;
  if(!locales.length||locales.some(l=>!l.attributes.description||!l.attributes.supportUrl||!l.attributes.whatsNew))throw Error('LISTING_INCOMPLETE');
  const old=(await api('/v1/apps/'+app+'/appStoreVersions?filter[platform]=IOS&limit=100')).data.find(x=>x.attributes.versionString==='1.0.2'&&x.attributes.appStoreState==='READY_FOR_SALE');
  if(!old)throw Error('EXISTING_PUBLIC_VERSION_MISSING');
  let detail=(await api('/v1/appStoreVersions/'+version+'/appStoreReviewDetail','GET',undefined,true))?.data;
  if(!detail){
   const previous=(await api('/v1/appStoreVersions/'+old.id+'/appStoreReviewDetail')).data;
   const attributes={};
   for(const k of ['contactEmail','contactFirstName','contactLastName','contactPhone','demoAccountName','demoAccountPassword','demoAccountRequired','notes'])if(previous.attributes[k]!=null)attributes[k]=previous.attributes[k];
   attributes.notes=(attributes.notes??'')+'\n\nVersion 1.0.3 improves the iOS notification sound. The production service is https://nitido.ro. No purchase is required to review this update. Pricing, payments and data collection are unchanged by this update.';
   detail=(await api('/v1/appStoreReviewDetails','POST',{type:'appStoreReviewDetails',attributes,relationships:{appStoreVersion:{data:{type:'appStoreVersions',id:version}}}})).data;
  }
  const a=detail.attributes;
  if(!['contactEmail','contactFirstName','contactLastName','contactPhone'].every(k=>Boolean(a[k])))throw Error('EXISTING_REVIEW_CONTACT_INCOMPLETE');
  proof.reviewContactPresent=true;proof.demoAccountRequired=a.demoAccountRequired===true;
  if(a.demoAccountRequired){
   if(!a.demoAccountName||!a.demoAccountPassword)throw Error('EXISTING_REVIEW_LOGIN_MISSING');
   const login=await fetch('https://nitido.ro/api/auth/login',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',Origin:'https://nitido.ro'},body:JSON.stringify({email:a.demoAccountName,password:a.demoAccountPassword})});
   const cookies=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
   if(!login.ok||!cookies)throw Error('EXISTING_REVIEW_LOGIN_NOT_VALID');
   try{
    const me=await fetch('https://nitido.ro/api/auth/me',{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Cookie:cookies}});
    if(!me.ok||!(await me.json()).user)throw Error('REVIEW_SESSION_NOT_VERIFIED');
    proof.reviewLoginVerified=true;
   }finally{
    const logout=await fetch('https://nitido.ro/api/auth/logout',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Cookie:cookies,Origin:'https://nitido.ro'}});
    if(!logout.ok)throw Error('REVIEW_SESSION_LOGOUT_FAILED');
    proof.reviewTestSessionClosed=true;
   }
  }
  const existing=(await api('/v1/apps/'+app+'/reviewSubmissions?filter[platform]=IOS&limit=50')).data;
  if(existing.some(x=>['WAITING_FOR_REVIEW','IN_REVIEW','UNRESOLVED_ISSUES','CANCELING'].includes(x.attributes.state)))throw Error('ANOTHER_REVIEW_SUBMISSION_ACTIVE');
  let submission=existing.find(x=>x.attributes.state==='READY_FOR_REVIEW');
  if(submission){
   const items=(await api('/v1/reviewSubmissions/'+submission.id+'/items')).data;
   if(items.some(x=>x.relationships?.appStoreVersion?.data?.id!==version))throw Error('OTHER_DRAFT_REVIEW_ITEMS_PRESENT');
   if(!items.some(x=>x.relationships?.appStoreVersion?.data?.id===version))await api('/v1/reviewSubmissionItems','POST',{type:'reviewSubmissionItems',relationships:{reviewSubmission:{data:{type:'reviewSubmissions',id:submission.id}},appStoreVersion:{data:{type:'appStoreVersions',id:version}}}});
  }else{
   submission=(await api('/v1/reviewSubmissions','POST',{type:'reviewSubmissions',attributes:{platform:'IOS'},relationships:{app:{data:{type:'apps',id:app}}}})).data;
   await api('/v1/reviewSubmissionItems','POST',{type:'reviewSubmissionItems',relationships:{reviewSubmission:{data:{type:'reviewSubmissions',id:submission.id}},appStoreVersion:{data:{type:'appStoreVersions',id:version}}}});
  }
  proof.reviewSubmissionId=submission.id;
  await api('/v1/reviewSubmissions/'+submission.id,'PATCH',{type:'reviewSubmissions',id:submission.id,attributes:{submitted:true}});
  const checked=(await api('/v1/reviewSubmissions/'+submission.id)).data;
  proof.state=checked.attributes.state;proof.appReviewSubmitted=['WAITING_FOR_REVIEW','IN_REVIEW','COMPLETED'].includes(proof.state);
  if(!proof.appReviewSubmitted)throw Error('REVIEW_SUBMISSION_NOT_CONFIRMED');
 }
}catch(e){proof.blockedReason=/^[A-Z0-9_]+$/.test(e.message)?e.message:'SUBMISSION_FAILED';process.exitCode=1;}
await fs.mkdir('.store-review',{recursive:true});await fs.writeFile('.store-review/receipt.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
