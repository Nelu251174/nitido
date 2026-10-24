// Run only in a disposable container with --network=none and no application secrets.
// Exercises actual HTTP handlers and SQLite. The built-in development payment
// adapter is deliberately used; this is not a Stripe or physical-device receipt.
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createRequire}=require('node:module');
const {randomBytes}=require('node:crypto');
const requireApp=createRequire('/app/package.json');
const Database=requireApp('better-sqlite3'),bcrypt=requireApp('bcryptjs'),sharp=requireApp('sharp');
const base='http://127.0.0.1:3000',origin='https://nitido.test';
const out=process.env.NITIDO_FLOW_REPORT_DIR||'/evidence';
if(process.cwd()!=='/app'||process.env.NODE_ENV!=='development'||process.env.NITIDO_SEED_DEMO!=='false')throw Error('ISOLATION_CONFIGURATION_REQUIRED');
for(const key of ['STRIPE_SECRET_KEY','RESEND_API_KEY','TWILIO_AUTH_TOKEN','APNS_PRIVATE_KEY','FIREBASE_PRIVATE_KEY','COOLIFY_TOKEN'])if(process.env[key])throw Error('REAL_SERVICE_BINDING_FORBIDDEN');
if(fs.existsSync('/app/data/nitido.db'))throw Error('FRESH_SYNTHETIC_DATABASE_REQUIRED');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync('/app/public/uploads',{recursive:true});
const log=fs.openSync(path.join(out,'isolated-server.log'),'w');
const server=spawn(process.execPath,['/app/node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3000'],{cwd:'/app',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SITE_URL:origin,PUSH_ENABLED:'false',NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED:'false'},stdio:['ignore',log,log]});
const report={startedAt:new Date().toISOString(),status:'running',source:process.env.NITIDO_FLOW_SOURCE,scope:'Isolated development HTTP lifecycle with synthetic SQLite, provider-free payment adapter',networkMode:'none',liveWrites:0,realPayments:0,realNotifications:0,physicalDeviceTested:false,checks:[]};
let db;const actors=new Map();
function check(name,ok,details){report.checks.push({name,passed:Boolean(ok),...(details?{details}:{} )});if(!ok)throw Error(name);}
async function request(actor,route,{method='GET',body,headers={},expected=200}={}){
 const a=actors.get(actor),form=body instanceof FormData;
 const r=await fetch(base+route,{method,redirect:'manual',signal:AbortSignal.timeout(120000),headers:{Origin:origin,...(a?.cookie?{Cookie:a.cookie}:{}),...(!form&&body?{'Content-Type':'application/json'}:{}),...headers},body:body?(form?body:JSON.stringify(body)):undefined});
 const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={nonJson:true};}
 if(![].concat(expected).includes(r.status))throw Error('HTTP '+method+' '+route+' expected '+expected+' got '+r.status+' '+JSON.stringify(data).slice(0,500));
 return {response:r,data,status:r.status};
}
async function upload(actor,jobId,type,image){const form=new FormData();form.set('file',new Blob([image],{type:'image/png'}),'synthetic.png');form.set('jobId',jobId);form.set('proofType',type);return (await request(actor,'/api/uploads',{method:'POST',body:form,expected:201})).data;}
async function main(){
 for(let n=0;n<120;n++){
  if(server.exitCode!==null)throw Error('APP_SERVER_EXITED');
  try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(2500)});if(r.ok&&(await r.json()).status==='ok')break;}catch{}
  if(n===119)throw Error('APP_SERVER_NOT_READY');await new Promise(r=>setTimeout(r,1000));
 }
 db=new Database('/app/data/nitido.db');db.pragma('foreign_keys=ON');
 check('fresh database has no real users',db.prepare('SELECT COUNT(*) n FROM users').get().n===0);
 const password='Synthetic-'+randomBytes(20).toString('hex'),hash=bcrypt.hashSync(password,10);
 const fixture=[['client','client'],['otherClient','client'],['firmA','firma'],['firmB','firma']];
 for(const [name,role]of fixture){db.prepare('INSERT INTO users(id,role,name,email,password_hash) VALUES(?,?,?,?,?)').run('qa_'+name,role,'Synthetic '+name,name.toLowerCase()+'@example.test',hash);if(role==='firma')db.prepare('INSERT INTO firms(id,user_id,coverage_city,verified) VALUES(?,?,?,1)').run('qa_'+name,'qa_'+name,'Constanța');actors.set(name,{role});}
 for(const [name,role]of fixture){const login=await request(null,'/api/auth/login',{method:'POST',body:{email:name.toLowerCase()+'@example.test',password},expected:200});actors.get(name).cookie=login.response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');const me=await request(name,'/api/auth/me');check('authenticate '+name,me.data.user?.id==='qa_'+name&&me.data.user.role===role);}
 await request(null,'/api/jobs',{expected:401});check('anonymous job access denied',true);
 const booking={street:'Strada Sintetică 1',city:'Constanța',sqm:80,bathroomCount:1,windowsSqm:0,spaceType:'apartament',whenType:'asap',mode:'standard',details:'Isolated synthetic lifecycle verification'};
 await request('client','/api/jobs',{method:'POST',body:booking,headers:{Origin:'https://untrusted.example.test'},expected:403});check('untrusted mutation origin denied',true);
 const created=await request('client','/api/jobs',{method:'POST',body:booking,headers:{'Idempotency-Key':'synthetic-lifecycle-20261024'},expected:201});
 const job=created.data.job;check('create Standard reservation',job?.status==='waiting'&&job.client_id==='qa_client');
 const before=db.prepare('SELECT price_gross,duration_minutes,buffer_minutes,pricing_snapshot FROM jobs WHERE id=?').get(job.id);
 const replay=await request('client','/api/jobs',{method:'POST',body:booking,headers:{'Idempotency-Key':'synthetic-lifecycle-20261024'}});check('reservation retry creates no duplicate',replay.data.job?.id===job.id&&db.prepare('SELECT COUNT(*) n FROM jobs').get().n===1);
 await request('otherClient','/api/jobs/'+job.id,{expected:[403,404]});check('other client cannot read reservation',true);
 const preview=await request('firmA','/api/jobs/'+job.id);check('unassigned firm cannot see private address',!preview.data.job?.street&&!preview.data.street);
 await request('firmA','/api/jobs/'+job.id+'/accept',{method:'POST',body:{},expected:409});check('Standard cannot use Express direct acceptance',true);
 const offers=[];
 for(const actor of ['firmA','firmB']){const r=await request(actor,'/api/jobs/'+job.id+'/offers',{method:'POST',body:{message:'Synthetic availability'},expected:[200,201]});offers.push(r.data.offerId??r.data.offer?.id??r.data.id);}
 check('two firms can offer',offers.every(Boolean));
 await request('firmA','/api/jobs/'+job.id+'/offers',{method:'POST',body:{message:'Duplicate'},expected:409});check('duplicate firm offer denied',true);
 await request('otherClient','/api/jobs/'+job.id+'/offers/'+offers[0],{method:'POST',body:{},expected:403});check('other client cannot select offer',true);
 const selected=await request('client','/api/jobs/'+job.id+'/offers/'+offers[0],{method:'POST',body:{}});check('owner selects firm and authorizes simulated payment',selected.data.job?.status==='accepted'&&selected.data.job.accepted_firm_id==='qa_firmA');
 await request('firmB','/api/jobs/'+job.id+'/arrived',{method:'POST',body:{},expected:409});check('unselected firm cannot start job',true);
 await request('client','/api/jobs/'+job.id+'/rating',{method:'POST',body:{stars:5},expected:[400,409]});check('review before completion denied',true);
 await request('firmA','/api/jobs/'+job.id+'/arrived',{method:'POST',body:{},expected:409});check('arrival without evidence denied',true);
 const image=await sharp({create:{width:64,height:64,channels:3,background:{r:40,g:160,b:90}}}).png().toBuffer();
 const rules=db.prepare('SELECT arrival_min,completion_min FROM job_photo_rules WHERE job_id=?').get(job.id)??{arrival_min:1,completion_min:1};
 let arrival;
 for(let n=0;n<rules.arrival_min;n++)arrival=await upload('firmA',job.id,'ARRIVAL',image);
 check('upload required arrival evidence',Boolean(arrival?.id));
 await request('otherClient','/api/uploads/'+arrival.id,{expected:[403,404]});check('other client cannot read evidence',true);
 await request('firmB','/api/uploads/'+arrival.id,{expected:[403,404]});check('unselected firm cannot read evidence',true);
 await request('client','/api/uploads/'+arrival.id);check('owner can read own job evidence',true);
 const arrived=await request('firmA','/api/jobs/'+job.id+'/arrived',{method:'POST',body:{}});check('arrival with valid evidence succeeds',arrived.data.job?.status==='arrived');
 await request('firmA','/api/jobs/'+job.id+'/complete',{method:'POST',body:{},expected:409});check('completion without evidence denied',true);
 for(let n=0;n<rules.completion_min;n++)await upload('firmA',job.id,'COMPLETION',image);
 check('upload required completion evidence',db.prepare("SELECT COUNT(*) n FROM job_photos WHERE job_id=? AND proof_type='COMPLETION' AND status='VALID'").get(job.id).n===rules.completion_min);
 const completed=await request('firmA','/api/jobs/'+job.id+'/complete',{method:'POST',body:{}});check('complete job with validated evidence',completed.data.job?.status==='completed');
 await request('firmA','/api/jobs/'+job.id+'/complete',{method:'POST',body:{}});
 const payment=db.prepare('SELECT status FROM payments WHERE job_id=?').get(job.id);check('simulated payment captured exactly once',payment?.status==='captured'&&db.prepare("SELECT COUNT(*) n FROM workflow_audit_log WHERE job_id=? AND event_type='PAYMENT_CAPTURED'").get(job.id).n===1);
 const rating=await request('client','/api/jobs/'+job.id+'/rating',{method:'POST',body:{stars:5,reviewText:'Synthetic completed job review.'},expected:201});check('verified review after completion succeeds',rating.data.verifiedJob===true);
 await request('client','/api/jobs/'+job.id+'/rating',{method:'POST',body:{stars:5},expected:409});check('duplicate review denied',true);
 await request('otherClient','/api/jobs/'+job.id+'/rating',{method:'POST',body:{stars:5},expected:[403,404]});check('other client cannot review job',true);
 const after=db.prepare('SELECT price_gross,duration_minutes,buffer_minutes,pricing_snapshot FROM jobs WHERE id=?').get(job.id);check('frozen price and duration preserved',JSON.stringify(before)===JSON.stringify(after));
 check('single payment and single review',db.prepare('SELECT COUNT(*) n FROM payments WHERE job_id=?').get(job.id).n===1&&db.prepare('SELECT COUNT(*) n FROM ratings WHERE job_id=?').get(job.id).n===1);
 for(const [name]of fixture){await request(name,'/api/auth/logout',{method:'POST',body:{}});await request(name,'/api/jobs',{expected:401});check('logout revokes '+name+' session',true);}
 check('all synthetic sessions closed',db.prepare('SELECT COUNT(*) n FROM sessions').get().n===0);
 check('database integrity preserved',db.pragma('integrity_check',{simple:true})==='ok'&&db.pragma('foreign_key_check').length===0);
 report.status='passed';report.syntheticJobs=1;report.completedJobs=1;report.verifiedReviews=1;
}
main().catch(e=>{report.status='failed';report.failure=e.message;report.checks.push({name:'flow execution',passed:false,details:e.message});process.exitCode=1;}).finally(async()=>{report.finishedAt=new Date().toISOString();report.passed=report.checks.filter(c=>c.passed).length;report.failed=report.checks.filter(c=>!c.passed).length;db?.close();server.kill('SIGTERM');await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(()=>{server.kill('SIGKILL');resolve()},5000).unref()});fs.closeSync(log);fs.writeFileSync(path.join(out,'http-lifecycle.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,passed:report.passed,failed:report.failed,failure:report.failure,scope:report.scope}));});
