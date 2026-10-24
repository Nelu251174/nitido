import fs from 'node:fs/promises';
import {createPrivateKey,sign} from 'node:crypto';
const app='6810752486',build='6001e27d-9cbd-45ac-b75d-3db441e0322c';
const key=createPrivateKey(process.env.ASC_PRIVATE_KEY.replace(/\\n/g,'\n'));
async function api(path,method='GET',data){
 const now=Math.floor(Date.now()/1000),b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const input=b({alg:'ES256',kid:process.env.ASC_KEY_ID,typ:'JWT'})+'.'+b({iss:process.env.ASC_ISSUER_ID,iat:now,exp:now+300,aud:'appstoreconnect-v1'});
 const jwt=input+'.'+sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const r=await fetch('https://api.appstoreconnect.apple.com'+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:data?JSON.stringify({data}):undefined});
 if(!r.ok){const e=await r.json().catch(()=>({}));throw Error('ASC_'+r.status+'_'+(e.errors??[]).map(x=>x.code).join('_'));}
 return r.status===204?{}:r.json();
}
const identity=await api('/v1/apps/'+app);
if(identity.data?.attributes?.bundleId!=='ro.nitido.app')throw Error('APP_IDENTITY_MISMATCH');
const candidate=await api('/v1/builds/'+build+'?include=preReleaseVersion');
if(candidate.data?.attributes?.version!=='20'||candidate.data?.attributes?.processingState!=='VALID'||!candidate.included?.some(x=>x.type==='preReleaseVersions'&&x.attributes.version==='1.0.3'))throw Error('BUILD_IDENTITY_MISMATCH');
const versions=(await api('/v1/apps/'+app+'/appStoreVersions?filter[platform]=IOS&include=build&limit=100')).data;
const previous=versions.find(x=>x.attributes.versionString==='1.0.2'&&x.attributes.appStoreState==='READY_FOR_SALE');
if(!previous)throw Error('EXISTING_PUBLIC_VERSION_MISSING');
let target=versions.find(x=>x.attributes.versionString==='1.0.3');
const proof={checkedAt:new Date().toISOString(),appId:app,version:'1.0.3',build:20,buildId:build,created:false,localizationsPrepared:0,localizationsUpdated:0,appReviewSubmitted:false,publicRelease:false,betaTestersOrGroupsChanged:false};
if(!target){
 const attributes={versionString:'1.0.3',platform:'IOS',releaseType:'MANUAL'};
 if(previous.attributes.copyright)attributes.copyright=previous.attributes.copyright;
 target=(await api('/v1/appStoreVersions','POST',{type:'appStoreVersions',attributes,relationships:{app:{data:{type:'apps',id:app}}}})).data;
 proof.created=true;
}
if(target.attributes.appStoreState!=='PREPARE_FOR_SUBMISSION')throw Error('DRAFT_NOT_EDITABLE');
const bound=target.relationships?.build?.data?.id;
if(bound&&bound!==build)throw Error('DRAFT_HAS_DIFFERENT_BUILD');
if(!bound)await api('/v1/appStoreVersions/'+target.id+'/relationships/build','PATCH',{type:'builds',id:build});
const oldLocales=(await api('/v1/appStoreVersions/'+previous.id+'/appStoreVersionLocalizations?limit=200')).data;
const newLocales=(await api('/v1/appStoreVersions/'+target.id+'/appStoreVersionLocalizations?limit=200')).data;
const notes={ro:'Am îmbunătățit sunetul notificărilor, cu o alertă clasică de tip SMS.',en:'Improved notification sound with a classic SMS-style alert.',de:'Verbesserter Benachrichtigungston mit einem klassischen SMS-Signal.',fr:'Son des notifications amélioré avec une alerte SMS classique.',bg:'Подобрен звук за известия с класически SMS сигнал.',hr:'Poboljšan zvuk obavijesti uz klasični SMS ton.',cs:'Vylepšený zvuk oznámení s klasickým SMS tónem.',da:'Forbedret notifikationslyd med en klassisk sms-tone.',nl:'Verbeterd meldingsgeluid met een klassieke sms-toon.'};
for(const old of oldLocales){
 const locale=old.attributes.locale,existing=newLocales.find(x=>x.attributes.locale===locale);
 const attributes={locale,whatsNew:notes[locale.split('-')[0]]??notes.en};
 for(const field of ['description','keywords','marketingUrl','supportUrl','promotionalText'])if(old.attributes[field]!=null)attributes[field]=old.attributes[field];
 if(!existing){await api('/v1/appStoreVersionLocalizations','POST',{type:'appStoreVersionLocalizations',attributes,relationships:{appStoreVersion:{data:{type:'appStoreVersions',id:target.id}}}});proof.localizationsPrepared++;}
 else {await api('/v1/appStoreVersionLocalizations/'+existing.id,'PATCH',{type:'appStoreVersionLocalizations',id:existing.id,attributes:{whatsNew:attributes.whatsNew}});proof.localizationsUpdated++;}
}
const checked=(await api('/v1/appStoreVersions/'+target.id+'?include=build')).data;
if(checked.relationships?.build?.data?.id!==build||checked.attributes.appStoreState!=='PREPARE_FOR_SUBMISSION')throw Error('DRAFT_VERIFICATION_FAILED');
const locales=(await api('/v1/appStoreVersions/'+target.id+'/appStoreVersionLocalizations?limit=200')).data;
proof.localeChecks=[];for(const l of locales){const sets=(await api('/v1/appStoreVersionLocalizations/'+l.id+'/appScreenshotSets?include=appScreenshots&limit=100')).data;proof.localeChecks.push({locale:l.attributes.locale,descriptionPresent:Boolean(l.attributes.description),supportUrlPresent:Boolean(l.attributes.supportUrl),releaseNotesPresent:Boolean(l.attributes.whatsNew),screenshotSetCount:sets.length});}
proof.versionId=target.id;proof.state=checked.attributes.appStoreState;proof.releaseType=checked.attributes.releaseType;
await fs.mkdir('.store-draft',{recursive:true});await fs.writeFile('.store-draft/receipt.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
