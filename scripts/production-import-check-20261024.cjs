// Smoke the actual standalone production build in an offline disposable container.
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const root='/app/runtime',out='/evidence';
if(!fs.existsSync(root+'/server.js')||fs.existsSync(root+'/data/nitido.db'))throw Error('FRESH_STANDALONE_REQUIRED');
fs.mkdirSync(root+'/public/uploads',{recursive:true});
const fd=fs.openSync(out+'/production-server.log','w');
const child=spawn(process.execPath,[root+'/server.js'],{cwd:root,env:{...process.env,NODE_ENV:'production',NITIDO_SEED_DEMO:'false',PORT:'3000',HOSTNAME:'127.0.0.1'},stdio:['ignore',fd,fd]});
const report={checkedAt:new Date().toISOString(),status:'running',mode:'Actual standalone production build; offline; fresh synthetic database',checks:[]};
async function run(){
 for(let n=0;n<60;n++){
  try{const r=await fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(2000)});if(r.ok)break;}catch{}
  if(n===59)throw Error('PRODUCTION_NOT_READY');await new Promise(r=>setTimeout(r,500));
 }
 for(const [path,status]of [['/api/health',200],['/api/uploads/synthetic-import-probe',401],['/api/workspace',401],['/api/jobs',401]]){
  const r=await fetch('http://127.0.0.1:3000'+path,{signal:AbortSignal.timeout(20000)});report.checks.push({path,expected:status,status:r.status,passed:r.status===status});if(r.status!==status)throw Error('UNEXPECTED_PRODUCTION_STATUS');
 }
 report.status='passed';
}
run().catch(e=>{report.status='failed';report.failure=e.message;process.exitCode=1}).finally(async()=>{child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);setTimeout(()=>{child.kill('SIGKILL');r()},5000).unref()});fs.closeSync(fd);fs.writeFileSync(out+'/production-import-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))});
