import fs from 'node:fs/promises';
import {createPrivateKey,sign} from 'node:crypto';
const output='.ios-store-readiness';
const env=process.env,bindings=Object.fromEntries(['APPLE_TEAM_ID','ASC_KEY_ID','ASC_ISSUER_ID','ASC_PRIVATE_KEY'].map(k=>[k,Boolean(env[k])]));
const report={checkedAt:new Date().toISOString(),bundleId:'ro.nitido.app',bindings,apiAuthorized:false,mutations:0,uploadAttempted:false};
try{
 if(!Object.values(bindings).every(Boolean))throw Error('PUBLISHING_BINDINGS_MISSING');
 const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000);
 const input=b64({alg:'ES256',kid:env.ASC_KEY_ID,typ:'JWT'})+'.'+b64({iss:env.ASC_ISSUER_ID,iat:now,exp:now+300,aud:'appstoreconnect-v1'});
 let key;try{key=createPrivateKey(env.ASC_PRIVATE_KEY.replace(/\\n/g,'\n'))}catch{throw Error('ASC_KEY_FORMAT_INVALID')}
 const jwt=input+'.'+sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
 async function get(path){const r=await fetch('https://api.appstoreconnect.apple.com'+path,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+jwt}});if(!r.ok)throw Error('ASC_HTTP_'+r.status);return r.json()}
 const apps=await get('/v1/apps?filter[bundleId]=ro.nitido.app&limit=2');
 if(apps.data?.length!==1)throw Error('NITIDO_APP_NOT_UNIQUELY_IDENTIFIED');
 report.apiAuthorized=true;report.appId=apps.data[0].id;
 let path='/v1/builds?filter[app]='+report.appId+'&limit=200&sort=-uploadedDate',complete=false;const builds=[];
 for(let page=0;page<5&&path;page++){
  const r=await get(path);for(const b of r.data??[])builds.push({id:b.id,version:b.attributes?.version,processingState:b.attributes?.processingState,uploadedDate:b.attributes?.uploadedDate});
  if(!r.links?.next){complete=true;path=''}else{const next=new URL(r.links.next);if(next.origin!=='https://api.appstoreconnect.apple.com')throw Error('ASC_NEXT_ORIGIN_INVALID');path=next.pathname+next.search}
 }
 report.buildListComplete=complete;report.buildCount=builds.length;report.maxIntegerBuild=complete&&builds.every(b=>/^[1-9]\d*$/.test(b.version))?Math.max(0,...builds.map(b=>Number(b.version))):null;
 report.recentBuilds=builds.slice(0,5);report.status='read_only_access_verified';
 const versions=await get('/v1/apps/'+report.appId+'/appStoreVersions?limit=100&include=build');
 report.appStoreVersions=(versions.data??[]).filter(v=>v.attributes?.platform==='IOS').map(v=>({id:v.id,version:v.attributes?.versionString,state:v.attributes?.appStoreState,releaseType:v.attributes?.releaseType,buildId:v.relationships?.build?.data?.id??null}));
 report.includedBuilds=(versions.included??[]).filter(x=>x.type==='builds').map(x=>({id:x.id,version:x.attributes?.version,processingState:x.attributes?.processingState}));
}catch(e){report.status='blocked';report.reason=/^[A-Z_0-9]+$/.test(e.message)?e.message:'ASC_READ_UNAVAILABLE'}
await fs.mkdir(output,{recursive:true});await fs.writeFile(output+'/readiness.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
