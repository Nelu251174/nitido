// Remove only the two temporary reports/logs created by this intervention; preserve operation receipts.
if(process.env.GITHUB_REPOSITORY!=='Nelu251174/nitido'||process.env.GITHUB_REF_NAME!=='codex/stop-testflight-20261025')throw Error('SCOPE_GUARD');
const base='https://api.github.com/repos/Nelu251174/nitido/actions/';
async function api(path,method='GET'){
 const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+process.env.GH_ACTIONS_TOKEN,Accept:'application/vnd.github+json','User-Agent':'NITIDO-Temporary-Report-Cleanup/1.0'},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(r.status===404&&method==='DELETE')return null;if(!r.ok)throw Error('GITHUB_HTTP_'+r.status);return r.status===204?null:r.json();
}
let removedArtifacts=0,removedLogs=0;
for(const id of [40193063077,40193171363]){
 const r=await api('runs/'+id);if(r.head_branch!=='codex/stop-testflight-20261025'||r.name!=='Owner requested TestFlight retirement 20261025'||r.status!=='completed')throw Error('RUN_IDENTITY_GUARD');
 const artifacts=await api('runs/'+id+'/artifacts?per_page=100');if(artifacts.total_count>artifacts.artifacts.length)throw Error('ARTIFACT_LIST_INCOMPLETE');
 for(const artifact of artifacts.artifacts){if(artifact.name!=='nitido-testflight-retirement')throw Error('ARTIFACT_IDENTITY_GUARD');await api('artifacts/'+artifact.id,'DELETE');removedArtifacts++;}
 await api('runs/'+id+'/logs','DELETE');removedLogs++;
}
console.log(JSON.stringify({temporaryArtifactsRemoved:removedArtifacts,temporaryLogsRemoved:removedLogs,operationRunsPreserved:2}));
