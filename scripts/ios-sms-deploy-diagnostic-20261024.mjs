// Explicit owner approval: "Da, aprob diagnosticul filtrat" (2026-10-24).
// Read only the exact failed NITIDO deployment with the existing CI identity.
// Export only selected infrastructure errors, never raw logs or environment values.
const id='g6mwopv0k4tw5ez1nabokseg';
const r=await fetch('https://coolify.nitido.ro/api/v1/deployments/'+id,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+process.env.COOLIFY_TOKEN}});
if(!r.ok){console.log(JSON.stringify({deployment:id,readable:false,httpStatus:r.status}));process.exit(0)}
const d=await r.json();let logs=d.logs??[];
if(typeof logs==='string'){try{logs=JSON.parse(logs)}catch{logs=[]}}
const errors=[], classifiers=[];
const patterns={
 missing_helper_container:/No such container/i,
 disk_full:/no space left on device/i,
 memory_exhausted:/out of memory|cannot allocate memory|oom.?kill/i,
 image_pull_denied:/pull access denied|requested access.*denied|manifest unknown/i,
 image_missing:/image.*not found|no such image/i,
 dns_failure:/could not resolve|name resolution|no such host/i,
 network_unreachable:/network is unreachable|no route to host|connection timed out/i,
 git_repository_denied:/repository not found|could not read.*remote repository|authentication failed/i,
 git_revision_missing:/not our ref|reference is not a tree|unknown revision|couldn't find remote ref/i,
 compose_invalid:/yaml.*error|invalid compose|invalid interpolation|services.*must be a mapping/i,
 permission_denied:/permission denied/i,
 port_busy:/port is already allocated|address already in use/i,
 missing_file:/no such file or directory/i,
};
for(const row of Array.isArray(logs)?logs:[]){
 for(const text of String(row.output??'').split(/\r?\n/)){
 for(const [code,re] of Object.entries(patterns))if(re.test(text))classifiers.push({code,phase:errors.length});
 if(!/error|fail|exception|fatal|unable|cannot|could not|not found|missing|invalid|Uh oh/i.test(text))continue;
 if(/token|secret|password|authorization|bearer|private.?key|api.?key|sk_[A-Za-z0-9]|ghp_|github_pat_|BEGIN.*KEY|docker (run|exec)|--env|\\$[A-Z_][A-Z_0-9]*/i.test(text))continue;
 errors.push(text.replace(/https?:\/\/\S+/g,'[URL omitted]').slice(0,600));
 }
}
console.log(JSON.stringify({deployment:id,readable:true,status:d.status,logsAccessible:Array.isArray(logs)&&logs.length>0,logEntryCount:logs.length,classifications:classifiers.slice(-30),infrastructureErrors:errors.slice(-15)}));
