import fs from 'node:fs/promises';
import {createPrivateKey,sign} from 'node:crypto';
const key=createPrivateKey(await fs.readFile(process.env.ASC_KEY_PATH,'utf8'));
const app='6810752486',out='.store-build20';
await fs.mkdir(out,{recursive:true});
async function get(path){
 const now=Math.floor(Date.now()/1000),b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const input=b({alg:'ES256',kid:process.env.ASC_KEY_ID,typ:'JWT'})+'.'+b({iss:process.env.ASC_ISSUER_ID,iat:now,exp:now+300,aud:'appstoreconnect-v1'});
 const token=input+'.'+sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const response=await fetch('https://api.appstoreconnect.apple.com'+path,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token}});
 if(!response.ok)throw Error('ASC_HTTP_'+response.status);return response.json();
}
const identity=await get('/v1/apps?filter[bundleId]=ro.nitido.app&limit=2');
if(identity.data?.length!==1||identity.data[0].id!==app)throw Error('NITIDO_IDENTITY_CHANGED');
for(let n=0;n<40;n++){
 const r=await get('/v1/builds?filter[app]='+app+'&filter[version]=20&limit=2&include=preReleaseVersion');
 if(r.data?.length>1)throw Error('BUILD_NOT_UNIQUE');
 const build=r.data?.[0],version=(r.included??[]).find(x=>x.type==='preReleaseVersions');
 const proof={checkedAt:new Date().toISOString(),bundleId:'ro.nitido.app',appId:app,build:20,version:version?.attributes?.version??null,buildId:build?.id??null,processingState:build?.attributes?.processingState??'NOT_VISIBLE_YET',appReviewSubmitted:false,publicRelease:false,betaTestersOrGroupsChanged:false};
 if(build&&proof.version!=='1.0.3')throw Error('VERSION_MISMATCH');
 await fs.writeFile(out+'/processing.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 if(proof.processingState==='VALID')break;
 if(['FAILED','INVALID'].includes(proof.processingState))throw Error('APPLE_PROCESSING_FAILED');
 if(n===39)throw Error('PROCESSING_PENDING');
 await new Promise(r=>setTimeout(r,15000));
}
