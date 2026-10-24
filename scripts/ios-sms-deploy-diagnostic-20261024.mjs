// Explicit owner approval: continue with the filtered diagnosis and store updates.
// Read only the exact failed NITIDO deployment with the existing CI identity.
// Export only selected infrastructure errors, never raw logs or environment values.
const id='g6mwopv0k4tw5ez1nabokseg';
const r=await fetch('https://coolify.nitido.ro/api/v1/deployments/'+id,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+process.env.COOLIFY_TOKEN}});
if(!r.ok){console.log(JSON.stringify({deployment:id,readable:false,httpStatus:r.status}));process.exit(0)}
const d=await r.json();let logs=d.logs??[];
if(typeof logs==='string'){try{logs=JSON.parse(logs)}catch{logs=[]}}
const errors=[];
for(const row of Array.isArray(logs)?logs:[]){
 const text=String(row.output??'');
 if(!/error response from daemon:|failed to solve:|fatal:|No such file|permission denied|could not resolve|invalid reference format|does not exist|configuration file|Error during|ERROR:|Uh oh/i.test(text))continue;
 if(/token|secret|password|authorization|bearer|private.?key|api.?key|sk_[A-Za-z0-9]|ghp_|github_pat_|BEGIN.*KEY|docker run/i.test(text))continue;
 errors.push(text.replace(/https?:\/\/\S+/g,'[URL omitted]').slice(0,600));
}
console.log(JSON.stringify({deployment:id,readable:true,status:d.status,logsAccessible:Array.isArray(logs)&&logs.length>0,infrastructureErrors:errors.slice(-12)}));
