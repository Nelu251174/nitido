/** Local browser acceptance with synthetic accounts and real client/MFA login. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes,createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';

const repo=path.resolve(new URL('..',import.meta.url).pathname),require=createRequire(path.join(repo,'package.json'));
const {chromium}=require(process.env.NITIDO_QA_PLAYWRIGHT??'playwright');
const Database=require('better-sqlite3'),bcrypt=require('bcryptjs');
const output=path.resolve(process.env.NITIDO_QA_OUTPUT??'/tmp/nitido-workspace-redesign-evidence');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-redesign-browser-'));
const port=Number(process.env.NITIDO_QA_PORT??3198),base=`http://localhost:${port}`;
const productionBuild=process.env.NITIDO_QA_BUILD_PATH;
const report={scope:'Isolated local browser, synthetic SQLite and real MFA/client login; no physical devices or LIVE data',startedAt:new Date().toISOString(),checks:[],layouts:[],pageErrors:[]};
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes){let bits=0,acc=0,text='';for(const byte of bytes){acc=(acc<<8)|byte;bits+=8;while(bits>=5){bits-=5;text+=alphabet[(acc>>>bits)&31];acc&=(1<<bits)-1;}}if(bits)text+=alphabet[(acc<<(5-bits))&31];return text;}
function code(secret){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const digest=createHmac('sha1',secret).update(counter).digest();return String((digest.readUInt32BE(digest[digest.length-1]&15)&0x7fffffff)%1000000).padStart(6,'0');}
const roles=['super_admin','operator','manager','finance'];
const accounts=roles.map(role=>{const secret=randomBytes(20);return{role,email:`${role}@example.test`,password:randomBytes(24).toString('hex'),secret,totpSecret:base32(secret)};});
const clientPassword=randomBytes(24).toString('hex');
let server,browser,db,log,currentPage;
async function check(name,fn){const details=await fn();report.checks.push({name,passed:true,details});}
async function layouts(page,label){
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);
  const dimensions=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,mainCount:document.querySelectorAll('main').length}));
  report.layouts.push({label,...dimensions,passed:dimensions.scrollWidth<=width+1});
  await page.screenshot({path:path.join(output,`${label}-${width}.png`),fullPage:true,caret:'initial'});
  assert(dimensions.scrollWidth<=width+1,`${label} document overflows at ${width}px (${dimensions.scrollWidth})`);
 }
}
async function context(){
 const c=await browser.newContext({viewport:{width:1440,height:1000},locale:'ro-RO',serviceWorkers:'block'});
 await c.route('**/*',route=>{const url=new URL(route.request().url());return url.origin===base||['data:','blob:'].includes(url.protocol)?route.continue():route.abort();});
 const page=await c.newPage(),requests=[];currentPage=page;page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>requests.push(new URL(r.url()).pathname));return{c,page,requests};
}
try{
 await fs.mkdir(output,{recursive:true});
 for(const entry of await fs.readdir(repo))if(['src','public','messages'].includes(entry)||/^(package.*\.json|next.*\.(js|mjs|ts)|tsconfig\.json|postcss.*|next-env\.d\.ts)$/.test(entry))await fs.cp(path.join(repo,entry),path.join(temporary,entry),{recursive:true});
 await fs.symlink(path.join(repo,'node_modules'),path.join(temporary,'node_modules'),'dir');
 await fs.mkdir(path.join(temporary,'public','uploads'),{recursive:true});
 if(productionBuild){const source=path.resolve(productionBuild);await fs.cp(source,path.join(temporary,'.next'),{recursive:true,filter:file=>!file.startsWith(path.join(source,'cache'))&&!file.startsWith(path.join(source,'standalone'))});report.buildId=(await fs.readFile(path.join(temporary,'.next/BUILD_ID'),'utf8')).trim();}
 const owner=accounts[0],env={...process.env,NODE_ENV:productionBuild?'production':'development',NEXT_TELEMETRY_DISABLED:'1',NITIDO_SEED_DEMO:'false',NEXT_PUBLIC_SITE_URL:productionBuild?'https://sandbox.nitido.ro':base,NITIDO_ADMIN_EMAIL:owner.email,NITIDO_ADMIN_PASSWORD_HASH:await bcrypt.hash(owner.password,10),NITIDO_ADMIN_TOTP_SECRET:owner.totpSecret};
 for(const key of Object.keys(env))if(/^(STRIPE_|NEXT_PUBLIC_STRIPE_|RESEND_|TWILIO_|COOLIFY_|FIREBASE_|APNS_|OPENAI_|AWS_|CRON_SECRET|NITIDO_ADMIN_PASSWORD$|NITIDO_ADMIN_RECOVERY_)/.test(key))delete env[key];
 Object.assign(env,{PUSH_ENABLED:'false',SMS_FALLBACK_ENABLED:'false',MARKETING_EMAIL_ENABLED:'false',NITIDO_OWNER_NOTIFICATIONS_ENABLED:'false',NITIDO_MARKETING_DELIVERY_ENABLED:'false',NITIDO_APPOINTMENT_REMINDERS_ENABLED:'false',NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED:'false',NITIDO_MARKETING_ADMIN_ENABLED:'true',NITIDO_ENABLE_BEARER_AUTH:'false'});
 env.NITIDO_ADMIN_STAFF_ACCOUNTS_JSON=JSON.stringify(await Promise.all(accounts.slice(1).map(async a=>({email:a.email,passwordHash:await bcrypt.hash(a.password,10),totpSecret:a.totpSecret}))));
 log=await fs.open(path.join(output,'server.log'),'w');
 server=spawn(process.execPath,[path.join(repo,'node_modules/next/dist/bin/next'),productionBuild?'start':'dev',...(productionBuild?[]:['--webpack']),'--hostname','localhost','--port',String(port)],{cwd:temporary,env,stdio:['ignore',log.fd,log.fd]});
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(server.exitCode!==null)throw Error('Local server stopped');try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready,'Local server failed to become ready');
 db=new Database(path.join(temporary,'data/nitido.db'));db.pragma('foreign_keys=ON');
 const hash=await bcrypt.hash(clientPassword,10);
 for(const [id,role,name,email]of[['qa-client','client','Client demonstrativ','client@example.test'],['qa-other','client','Alt client demonstrativ','other@example.test'],['qa-provider','firma','Firmă demonstrativă','provider@example.test']])db.prepare('INSERT INTO users(id,role,name,email,password_hash) VALUES(?,?,?,?,?)').run(id,role,name,email,hash);
 db.prepare("INSERT INTO firms(id,user_id,coverage_city,verified) VALUES('qa-firm','qa-provider','Constanța',1)").run();
 for(const a of accounts.slice(1))db.prepare('INSERT INTO admin_staff(id,email,role,active,revision) VALUES(?,?,?,1,1)').run('qa-'+a.role,a.email,a.role);
 const now=Date.now(),today=new Date(now+3600000).toISOString(),created=new Date(now-3*3600000).toISOString();
 const insertJob=db.prepare('INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,status,accepted_firm_id,created_at,mode) VALUES(?,?,?,?,60,?,\'scheduled\',?,400,120,?,?,?,\'standard\')');
 insertJob.run('qa-job-next','qa-client','Adresă demonstrativă 1','Constanța','apartament',today,'accepted','qa-firm',created);
 insertJob.run('qa-job-waiting','qa-client','Adresă demonstrativă 2','Constanța','apartament',new Date(now+7200000).toISOString(),'waiting',null,created);
 insertJob.run('qa-job-completed','qa-client','Adresă demonstrativă 3','Constanța','apartament',new Date(now-86400000).toISOString(),'completed','qa-firm',created);
 insertJob.run('qa-job-private','qa-other','Adresă privată alt cont','Brașov','casa',new Date(now+86400000).toISOString(),'waiting',null,created);
 db.prepare("INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status) VALUES('qa-payment','qa-job-completed',400,60,340,'captured')").run();
 db.prepare("INSERT INTO workspace_properties(id,owner_id,name,city,street,sqm,space_type,created_at) VALUES('qa-home','qa-client','Locuința demonstrativă','Constanța','Adresă demonstrativă 1',60,'apartament',?)").run(created);
 db.prepare("INSERT INTO visit_cases(id,job_id,opened_by,request_key,category,description,created_at,updated_at) VALUES('qa-case','qa-job-completed','qa-client','qa-case-request','other','Sesizare demonstrativă pentru verificarea interfeței',?,?)").run(created,created);
 browser=await chromium.launch({executablePath:process.env.NITIDO_QA_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 {
  const {c,page}=await context();
  await check('Client authenticates with actual login handler',async()=>{const r=await c.request.post(base+'/api/auth/login',{data:{email:'client@example.test',password:clientPassword,role:'client'}});assert.equal(r.status(),200);return{status:r.status()};});
  await page.goto(base+'/client',{waitUntil:'domcontentloaded'});
  await page.locator('.workspace-redesign-client').waitFor();
  await check('Client home prioritizes real booking and protects other accounts',async()=>{await page.locator('.client-next-booking').getByRole('button',{name:'Vezi rezervarea',exact:true}).waitFor();const text=await page.locator('main').innerText();assert(text.includes('Adresă demonstrativă 1'));assert(!text.includes('Adresă privată alt cont'));assert(!text.includes('Alt client demonstrativ'));return{privateClientAbsent:true,realBookingVisible:true};});
  await layouts(page,'client-home');
  await check('Client opens the exact booking in a stable address',async()=>{await page.getByRole('button',{name:'Vezi rezervarea',exact:true}).click();await page.waitForURL(url=>url.pathname==='/client/rezervari'&&url.searchParams.get('jobId')==='qa-job-next');await page.locator('.execution-heading').waitFor();await page.reload({waitUntil:'domcontentloaded'});await page.locator('.execution-heading').waitFor();return{selectedJob:'qa-job-next',reloadPreservesSelection:true};});
  for(const route of ['/client/rezervari','/client/plati','/client/cont'])await check('Client route '+route,async()=>{await page.goto(base+route,{waitUntil:'domcontentloaded'});await page.locator('.workspace-redesign-client').waitFor();assert(!(await page.locator('body').innerText()).includes('Application error'));return{route,heading:await page.locator('main h1').first().innerText()};});
  await layouts(page,'client-account');
  await check('Client cookie does not grant administrative API access',async()=>{for(const route of ['/api/admin/auth/me','/api/admin/dashboard','/api/admin/overview','/api/admin/workbench'])assert.equal((await c.request.get(base+route)).status(),401);return{denied:4};});
  await c.close();
 }
 for(const account of accounts){
  const {c,page}=await context();
  await check(account.role+' authenticates with password and actual TOTP',async()=>{const r=await c.request.post(base+'/api/admin/auth/login',{headers:{origin:base},data:{email:account.email,password:account.password,code:code(account.secret),method:'totp'}});assert.equal(r.status(),200);return{status:r.status()};});
  await page.goto(base+'/admin',{waitUntil:'domcontentloaded'});await page.locator('.workspace-redesign-admin').waitFor();
  if(account.role==='super_admin'){
   await page.locator('.workspace-redesign-metric strong').first().waitFor();
   await layouts(page,'admin-today');
   for(const route of ['/admin/lucrari','/admin/clienti','/admin/firme','/admin/suport','/admin/financiar','/admin/marketing','/admin/rapoarte','/admin/raport-rezervari','/admin/setari'])await check('Owner route '+route,async()=>{await page.goto(base+route,{waitUntil:'domcontentloaded'});await page.locator('.workspace-redesign-admin').waitFor();assert(!(await page.locator('body').innerText()).includes('Application error'));return{route};});
   await page.goto(base+'/admin/lucrari',{waitUntil:'domcontentloaded'});await page.locator('.workspace-table tbody tr').first().waitFor();await layouts(page,'admin-jobs');
   await check('Administrative dossier retains list search and context',async()=>{await page.locator('input[name=q]').fill('qa-job-next');await page.getByRole('button',{name:'Aplică filtrele',exact:true}).click();await page.waitForURL(url=>url.searchParams.get('q')==='qa-job-next');await page.locator('.workspace-table tbody tr').first().getByRole('link',{name:'Deschide',exact:true}).click();await page.waitForURL(url=>url.searchParams.get('jobId')==='qa-job-next');await page.locator('.workspace-redesign-inspector h3').waitFor();assert.equal(new URL(page.url()).searchParams.get('q'),'qa-job-next');return{jobId:'qa-job-next',queryPreserved:true};});
   await layouts(page,'admin-job-detail');
   await page.goto(base+'/admin/clienti?clientId=qa-client',{waitUntil:'domcontentloaded'});await page.locator('.admin-customer-record h2').waitFor();await layouts(page,'admin-customer');
   await page.goto(base+'/admin/suport?tab=incidente&jobId=qa-job-completed&caseId=qa-case',{waitUntil:'domcontentloaded'});await page.getByText('Sesizare demonstrativă pentru verificarea interfeței',{exact:true}).waitFor();await layouts(page,'admin-incident');
  }
  await check(account.role+' dashboard preserves permissions and destructive reset is unavailable',async()=>{const r=await c.request.get(base+'/api/admin/dashboard');assert.equal(r.status(),account.role==='finance'?403:200);const reset=await c.request.post(base+'/api/admin/reset-history',{headers:{origin:base},data:{confirm:true}});assert.equal(reset.status(),account.role==='super_admin'?403:401);assert.equal(db.prepare('SELECT COUNT(*) n FROM jobs').get().n,4);return{dashboardStatus:r.status(),resetStatus:reset.status()};});
  await c.close();
 }
 assert.deepEqual(report.pageErrors,[],'Browser runtime errors detected');
 assert.equal(db.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(db.pragma('foreign_key_check'),[]);
 report.status='passed';
}catch(error){report.status='failed';report.failure=error.message;await currentPage?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{
 await browser?.close();db?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);if(server.exitCode===null)server.kill('SIGKILL');}await log?.close();
 report.finishedAt=new Date().toISOString();await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await fs.rm(temporary,{recursive:true,force:true});
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,layouts:report.layouts.length,pageErrors:report.pageErrors.length,failure:report.failure,output}));
}
