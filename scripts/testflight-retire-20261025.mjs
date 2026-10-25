// Owner requested retirement of TestFlight only. Never uploads, releases, deletes apps or reads testers.
import {createPrivateKey,sign} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const BUNDLE='ro.nitido.app';
const REPO='Nelu251174/nitido',APPLE='https://api.appstoreconnect.apple.com';
export function appleToken(env){
 for(const k of ['APP_STORE_CONNECT_KEY_ID','APP_STORE_CONNECT_ISSUER_ID','APP_STORE_CONNECT_API_KEY'])if(!env[k])throw Error('APPLE_BINDING_MISSING');
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000);
 const input=enc({alg:'ES256',kid:env.APP_STORE_CONNECT_KEY_ID,typ:'JWT'})+'.'+enc({iss:env.APP_STORE_CONNECT_ISSUER_ID,iat:now,exp:now+600,aud:'appstoreconnect-v1'});
 return input+'.'+sign('sha256',Buffer.from(input),{key:createPrivateKey(env.APP_STORE_CONNECT_API_KEY.replaceAll('\\n','\n')),dsaEncoding:'ieee-p1363'}).toString('base64url');
}
export function apiClient(origin,token,fetcher=fetch){
 return async(path,method='GET',body)=>{
  const u=new URL(path,origin);if(u.origin!==origin||u.username||u.password)throw Error('API_ORIGIN_GUARD');
  if(origin===APPLE&&method!=='GET'){
   const parts=u.pathname.split('/'),expected={builds:{expired:true},buildBetaDetails:{autoNotifyEnabled:false},betaGroups:{publicLinkEnabled:false}}[parts[2]];
   if(method!=='PATCH'||parts.length!==4||!expected||body?.data?.id!==parts[3]||body.data.type!==parts[2]||JSON.stringify(body.data.attributes)!==JSON.stringify(expected)||Object.hasOwn(body.data,'relationships'))throw Error('APPLE_MUTATION_GUARD');
  }
  if(origin==='https://api.github.com'){
   const base='/repos/'+REPO+'/actions/',allowed=method==='GET'&&u.pathname.startsWith(base+'workflows/')||method==='PUT'&&new RegExp('^'+base+'workflows/[0-9]+/disable$').test(u.pathname)||method==='POST'&&new RegExp('^'+base+'runs/[0-9]+/cancel$').test(u.pathname);
   if(!allowed)throw Error('GITHUB_SCOPE_GUARD');
  }
  const r=await fetcher(u,{method,headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json','User-Agent':'NITIDO-TestFlight-Retirement/1.0'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error((origin===APPLE?'APPLE':'GITHUB')+'_HTTP_'+r.status);
  return r.status===204?null:r.json();
 };
}
async function pages(api,path){const seen=new Set(),data=[],included=[];while(path){if(seen.has(path))throw Error('PAGINATION_CYCLE');seen.add(path);const r=await api(path);if(!Array.isArray(r.data))throw Error('API_DATA_INVALID');data.push(...r.data);included.push(...r.included??[]);path=r.links?.next??null;}return {data,included};}
export async function inspectApple(api){
 const apps=await api('/v1/apps?filter[bundleId]='+BUNDLE+'&limit=2');if(apps.data?.length!==1||apps.data[0].attributes?.bundleId!==BUNDLE)throw Error('APPLE_APP_IDENTITY_GUARD');
 const id=apps.data[0].id;
 const versions=await pages(api,'/v1/apps/'+id+'/appStoreVersions?filter[platform]=IOS&include=build&limit=200');
 const raw=await pages(api,'/v1/builds?filter[app]='+encodeURIComponent(id)+'&include=preReleaseVersion,buildBetaDetail&limit=200');
 const related=new Map(raw.included.map(x=>[x.type+':'+x.id,x]));
 const builds=raw.data.map(b=>{const detail=related.get('buildBetaDetails:'+b.relationships?.buildBetaDetail?.data?.id),pre=related.get('preReleaseVersions:'+b.relationships?.preReleaseVersion?.data?.id);return {id:b.id,build:b.attributes.version,version:pre?.attributes.version??null,expired:b.attributes.expired,expirationDate:b.attributes.expirationDate,processingState:b.attributes.processingState,betaDetailId:detail?.id??null,autoNotifyEnabled:detail?.attributes.autoNotifyEnabled??null,internalState:detail?.attributes.internalBuildState??null,externalState:detail?.attributes.externalBuildState??null};});
 if(builds.some(b=>typeof b.expired!=='boolean'))throw Error('BUILD_EXPIRATION_UNKNOWN');
 const groups=await pages(api,'/v1/apps/'+id+'/betaGroups?fields[betaGroups]=isInternalGroup,publicLinkEnabled,hasAccessToAllBuilds&limit=200');
 return {bundleId:BUNDLE,appId:id,versions:versions.data.map(v=>({id:v.id,version:v.attributes.versionString,state:v.attributes.appStoreState,releaseType:v.attributes.releaseType,buildId:v.relationships?.build?.data?.id??null})),builds,groups:groups.data.map(g=>({id:g.id,isInternalGroup:g.attributes.isInternalGroup,publicLinkEnabled:g.attributes.publicLinkEnabled===true,hasAccessToAllBuilds:g.attributes.hasAccessToAllBuilds===true}))};
}
export async function retireApple(api,before){
 if(before.bundleId!==BUNDLE||!before.appId)throw Error('APPLE_APP_IDENTITY_GUARD');
 const result={expiredBuilds:[],notificationsDisabled:[],publicLinksDisabled:[],appStoreWrites:0};
 for(const b of before.builds){
  if(b.autoNotifyEnabled===true&&b.betaDetailId){await api('/v1/buildBetaDetails/'+b.betaDetailId,'PATCH',{data:{type:'buildBetaDetails',id:b.betaDetailId,attributes:{autoNotifyEnabled:false}}});result.notificationsDisabled.push(b.build);}
 }
 for(const g of before.groups)if(!g.isInternalGroup&&g.publicLinkEnabled){await api('/v1/betaGroups/'+g.id,'PATCH',{data:{type:'betaGroups',id:g.id,attributes:{publicLinkEnabled:false}}});result.publicLinksDisabled.push(g.id);}
 for(const b of before.builds)if(!b.expired){await api('/v1/builds/'+b.id,'PATCH',{data:{type:'builds',id:b.id,attributes:{expired:true}}});result.expiredBuilds.push(b.build);}
 const after=await inspectApple(api);if(after.appId!==before.appId)throw Error('APPLE_APP_CHANGED');
 if(after.builds.some(b=>!b.expired)||after.groups.some(g=>g.publicLinkEnabled)||after.builds.some(b=>b.autoNotifyEnabled===true))throw Error('TESTFLIGHT_RETIREMENT_INCOMPLETE');
 return {...result,after,appStoreSnapshotUnchanged:JSON.stringify(after.versions)===JSON.stringify(before.versions)};
}
export async function publisherStatus(api,retire=false){
 const path='/repos/'+REPO+'/actions/workflows/mobile-ios.yml',w=await api(path);
 if(w.path!=='.github/workflows/mobile-ios.yml'||!/TestFlight/i.test(w.name))throw Error('WORKFLOW_IDENTITY_GUARD');
 let cancelled=0;const active=[];
 for(const state of ['in_progress','queued','waiting','requested','pending']){
  let next='/repos/'+REPO+'/actions/workflows/'+w.id+'/runs?status='+state+'&per_page=100';const seen=new Set();
  while(next){if(seen.has(next))throw Error('GITHUB_PAGINATION_CYCLE');seen.add(next);const r=await api(next);for(const run of r.workflow_runs??[]){if(run.workflow_id!==w.id)throw Error('WORKFLOW_RUN_IDENTITY_GUARD');active.push({id:run.id,status:run.status});}next=null;/* GitHub's per-workflow uploader has no parallel fleet; fail closed rather than truncate. */if((r.total_count??0)>(r.workflow_runs?.length??0))throw Error('UPLOADER_RUN_LIST_INCOMPLETE');}
 }
 if(retire){
  if(w.state!=='disabled_manually')await api('/repos/'+REPO+'/actions/workflows/'+w.id+'/disable','PUT');
  for(const run of new Map(active.map(r=>[r.id,r])).values()){await api('/repos/'+REPO+'/actions/runs/'+run.id+'/cancel','POST');cancelled++;}
  // Only this uploader is disabled; public App Store review/release workflows are outside scope.
  const current=await api(path);if(current.state!=='disabled_manually')throw Error('UPLOADER_NOT_DISABLED');
  return {id:w.id,path:w.path,state:current.state,cancelledRuns:cancelled};
 }
 return {id:w.id,path:w.path,state:w.state,activeRuns:active};
}
export async function main(env=process.env){
 const mode=env.TESTFLIGHT_MODE??'inspect',report={checkedAt:new Date().toISOString(),mode,bundleId:BUNDLE,status:'started',mutations:0};
 try{
  if(!['inspect','retire'].includes(mode)||env.GITHUB_REPOSITORY!==REPO||env.GITHUB_REF_NAME!=='codex/stop-testflight-20261025')throw Error('RUN_SCOPE_GUARD');
  if(mode==='retire'&&env.TESTFLIGHT_OWNER_AUTHORIZATION!=='ro.nitido.app:stop:2026-10-25')throw Error('OWNER_AUTHORIZATION_REQUIRED');
  const api=apiClient(APPLE,appleToken(env));report.before=await inspectApple(api);
  if(mode==='retire'){
   try{report.publisher=await publisherStatus(apiClient('https://api.github.com',env.GH_ACTIONS_TOKEN),true);}catch(e){report.publisher={status:'blocked',reason:/^[A-Z_0-9]+$/.test(e.message)?e.message:'UPLOADER_STOP_FAILED'};}
   report.result=await retireApple(api,report.before);report.mutations=report.result.expiredBuilds.length+report.result.notificationsDisabled.length+report.result.publicLinksDisabled.length;report.status='testflight_retired';
   if(report.publisher.status==='blocked'){report.status='testflight_retired_uploader_blocked';process.exitCode=1;}
  }else{report.publisher=await publisherStatus(apiClient('https://api.github.com',env.GH_ACTIONS_TOKEN));report.status='read_only_verified';}
 }catch(e){report.status='blocked';report.reason=/^[A-Z_0-9]+$/.test(e.message)?e.message:'TESTFLIGHT_OPERATION_FAILED';process.exitCode=1;}
 await mkdir('.testflight-stop',{recursive:true});await writeFile('.testflight-stop/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
