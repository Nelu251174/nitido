// Read-only App Store state. Signing/API material is never written to an artifact.
import {createSign} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const required=['APP_STORE_CONNECT_KEY_ID','APP_STORE_CONNECT_ISSUER_ID','APP_STORE_CONNECT_API_KEY'];
if(required.some(k=>!process.env[k])){console.log(JSON.stringify({status:'blocked',reason:'APPLE_API_BINDINGS_MISSING'}));process.exit(0)}
try{
 const now=Math.floor(Date.now()/1000),b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const input=b64({alg:'ES256',kid:process.env.APP_STORE_CONNECT_KEY_ID,typ:'JWT'})+'.'+b64({iss:process.env.APP_STORE_CONNECT_ISSUER_ID,iat:now,exp:now+600,aud:'appstoreconnect-v1'});
 const sign=createSign('SHA256');sign.update(input);sign.end();const token=input+'.'+sign.sign({key:process.env.APP_STORE_CONNECT_API_KEY.replaceAll('\\n','\n'),dsaEncoding:'ieee-p1363'}).toString('base64url');
 async function get(path){const u=new URL(path,'https://api.appstoreconnect.apple.com');if(u.origin!=='https://api.appstoreconnect.apple.com')throw Error('INVALID_ORIGIN');const r=await fetch(u,{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('APPLE_HTTP_'+r.status);return r.json()}
 const apps=await get('/v1/apps?filter[bundleId]=ro.nitido.app&limit=2');if(apps.data.length!==1)throw Error('APPLE_IDENTITY_NOT_UNIQUE');const id=apps.data[0].id;
 const versions=await get('/v1/apps/'+id+'/appStoreVersions?filter[platform]=IOS&limit=10');
 const result={status:'verified',bundleId:'ro.nitido.app',appId:id,checkedAt:new Date().toISOString(),versions:versions.data.map(v=>({version:v.attributes.versionString,state:v.attributes.appStoreState,releaseType:v.attributes.releaseType})),pushReceptionTested:false};
 await writeFile('apple-store-status.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){const code=/^APPLE_[A-Z_0-9]+$/.test(e.message)?e.message:'APPLE_STATUS_FAILED';console.error(JSON.stringify({status:'blocked',reason:code}));process.exitCode=1}
