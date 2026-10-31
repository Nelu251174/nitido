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
const output=path.resolve(process.env.NITIDO_QA_OUTPUT??'/tmp/nitido-navigation-evidence');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-redesign-browser-'));
const port=Number(process.env.NITIDO_QA_PORT??3208),base=`http://localhost:${port}`;
const productionBuild=process.env.NITIDO_QA_BUILD_PATH;
const report={scope:'Isolated local browser, synthetic SQLite and real MFA/client login; no physical devices or LIVE data',startedAt:new Date().toISOString(),checks:[],layouts:[],pageErrors:[],navigation:[],colors:[]};
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes){let bits=0,acc=0,text='';for(const byte of bytes){acc=(acc<<8)|byte;bits+=8;while(bits>=5){bits-=5;text+=alphabet[(acc>>>bits)&31];acc&=(1<<bits)-1;}}if(bits)text+=alphabet[(acc<<(5-bits))&31];return text;}
function code(secret){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const digest=createHmac('sha1',secret).update(counter).digest();return String((digest.readUInt32BE(digest[digest.length-1]&15)&0x7fffffff)%1000000).padStart(6,'0');}
const roles=['super_admin','operator','manager','finance'];
const accounts=roles.map(role=>{const secret=randomBytes(20);return{role,email:`${role}@example.test`,password:randomBytes(24).toString('hex'),secret,totpSecret:base32(secret)};});
const clientPassword=randomBytes(24).toString('hex');
let server,browser,db,log,currentPage;
async function check(name,fn){const details=await fn();report.checks.push({name,passed:true,details});}
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

 const instrument = () => {
  const round=value=>Math.round(value*100)/100;
  const rect=selector=>{const node=document.querySelector(selector);if(!node)return null;const r=node.getBoundingClientRect();return {left:round(r.left),top:round(r.top),width:round(r.width),height:round(r.height)};};
  window.__nitidoNavFrames=[];
  window.__nitidoFrame=()=>({t:round(performance.now()),origin:performance.timeOrigin,path:location.pathname,workspace:!!document.querySelector('.workspace-redesign'),sidebar:!!document.querySelector('.client-workspace-sidebar,.board-sidebar'),main:rect('.client-workspace-main,.workspace-redesign-main'),body:rect('body'),bodyBg:getComputedStyle(document.body??document.documentElement).backgroundColor,htmlWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,scrollY:round(scrollY),historyLength:history.length});
  const tick=()=>{if(document.body){window.__nitidoNavFrames.push(window.__nitidoFrame());if(window.__nitidoNavFrames.length>2400)window.__nitidoNavFrames.shift();}requestAnimationFrame(tick);};requestAnimationFrame(tick);
 };
 const colorSample=async(page,label)=>{
  const sample=await page.evaluate(()=>{
   const selectors=['body','.workspace-redesign','.client-workspace-main','.client-workspace-sidebar','.workspace-redesign-main','.workspace-redesign-content','.workspace-nav-item[aria-current="page"]','.design-panel','.client-workspace-stat','.v2-btn-primary','.workspace-redesign-section-nav [aria-current="page"]','nav[aria-label="Secțiuni Marketing"] button[aria-current="page"]'];
   const basics=Object.fromEntries(selectors.map(selector=>{const node=document.querySelector(selector);if(!node)return[selector,null];const c=getComputedStyle(node);return[selector,{background:c.backgroundColor,color:c.color,border:c.borderColor,transform:c.transform,zoom:c.zoom}];}));
   const panels=[...document.querySelectorAll('.workspace-redesign-admin .workspace-redesign-content section, .workspace-redesign-admin .workspace-redesign-content article, .workspace-redesign-admin .workspace-redesign-content [style*="background"]')].slice(0,35).map(node=>{const c=getComputedStyle(node);return {tag:node.tagName,className:node.className,heading:node.querySelector('h2,h3,h4')?.textContent?.slice(0,100)??null,background:c.backgroundColor,color:c.color,border:c.borderColor};});
   return {...basics,panels};
  });report.colors.push({label,path:new URL(page.url()).pathname,sample});
  if(process.env.NITIDO_QA_ENFORCE_STABILITY==='true'&&label.startsWith('admin-')){
   for(const panel of sample.panels??[])assert(!['rgb(251, 247, 239)','rgb(247, 243, 236)'].includes(panel.background),`Legacy beige ADMIN panel at ${label}: ${panel.heading}`);
   const marketing=sample['nav[aria-label="Secțiuni Marketing"] button[aria-current="page"]'];
   // The pointer stays over the clicked tab, whose hover shade is intentionally darker.
   if(marketing){assert(['rgb(0, 122, 74)','rgb(0, 98, 60)'].includes(marketing.background),'Marketing active/hover background');assert.equal(marketing.color,'rgb(255, 255, 255)','Marketing active text');}
  }
 };
 const clickTrace=async(page,{scope,href,label,width,targetSelector})=>{
  const selector=scope==='client'?'.client-workspace-sidebar':'.board-sidebar';
  // Exact href avoids selecting similarly named links in the page content.
  const target=page.locator(targetSelector??`${selector} a.workspace-nav-item[href="${href}"]`).first();
  if(!await target.isVisible()&&!targetSelector)await page.locator(selector+' .workspace-menu-toggle').click();
  const before=await page.evaluate(()=>{window.__nitidoNavFrames=[];return window.__nitidoFrame();});
  await target.click();
  await page.waitForURL(url=>url.pathname===href.split('?')[0]);
  await page.locator(scope==='client'?'.workspace-redesign-client':'.workspace-redesign-admin').waitFor();
  await page.waitForTimeout(800);
  const frames=await page.evaluate(()=>window.__nitidoNavFrames),after=await page.evaluate(()=>window.__nitidoFrame());
  const missing=frames.filter(frame=>!frame.workspace||!frame.sidebar||!frame.main);
  const mainWidths=frames.filter(frame=>frame.main).map(frame=>frame.main.width);
  const mainLeft=frames.filter(frame=>frame.main).map(frame=>frame.main.left);
  const trace={scope,label,width,href,before,after,frames,summary:{frames:frames.length,missingWorkspaceFrames:missing.length,missingFromMs:missing[0]?.t??null,missingToMs:missing.at(-1)?.t??null,documentReload:before.origin!==after.origin,mainWidthMin:mainWidths.length?Math.min(...mainWidths):null,mainWidthMax:mainWidths.length?Math.max(...mainWidths):null,mainLeftMin:mainLeft.length?Math.min(...mainLeft):null,mainLeftMax:mainLeft.length?Math.max(...mainLeft):null,horizontalOverflow:frames.some(frame=>frame.scrollWidth>width+1)}};
  report.navigation.push(trace);
  await fs.writeFile(path.join(output,'partial-report.json'),JSON.stringify({buildId:report.buildId,navigation:report.navigation.map(trace=>({...trace,frames:undefined})),colors:report.colors},null,2)+'\n');
  console.log(JSON.stringify({scope,label,width,...trace.summary}));
  if(process.env.NITIDO_QA_ENFORCE_STABILITY==='true'){
   assert.equal(missing.length,0,`${scope} ${label} at${width}px loses workspace/sidebar`);
   if(width>=761){assert(Math.max(...mainWidths)-Math.min(...mainWidths)<=2,`${scope} ${label} width moved`);assert(Math.max(...mainLeft)-Math.min(...mainLeft)<=2,`${scope} ${label} left moved`);}
   assert.equal(trace.summary.documentReload,false,`${scope} ${label} unexpectedly reloads document`);
   assert.equal(trace.summary.horizontalOverflow,false,`${scope} ${label} overflows the viewport`);
  }
  await colorSample(page,scope+'-'+label+'-'+width);
 };
 {
  const {c,page}=await context();
  await page.addInitScript(instrument);
  await c.route('**/api/auth/me',async route=>{await new Promise(resolve=>setTimeout(resolve,450));await route.continue();});
  await check('Real client login in isolated fixture',async()=>{const response=await c.request.post(base+'/api/auth/login',{data:{email:'client@example.test',password:clientPassword,role:'client'}});assert.equal(response.status(),200);return{status:response.status()};});
  await page.goto(base+'/client/plati',{waitUntil:'domcontentloaded'});await page.locator('.workspace-redesign-client').waitFor();
  for(const width of [2048,1440,390]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);
   const sequence=[['/client','Acasă-from-payments'],['/client/rezervari','Rezervări'],['/client','Acasă-from-bookings'],['/client','Acasă-same-page'],['/client/plati','Plăți'],['/client','Acasă-repeat']];
   for(const [href,label]of sequence)await clickTrace(page,{scope:'client',href,label,width});
   await page.screenshot({path:path.join(output,`client-navigation-${width}.png`),fullPage:true});
   await clickTrace(page,{scope:'client',href:'/client/plati',label:'Plăți-end',width});
  }
  await c.close();
 }
 if(process.env.NITIDO_QA_SKIP_ADMIN!=='true'){
  const account=accounts[0],{c,page}=await context();await page.addInitScript(instrument);
  await check('Real ADMIN password and TOTP in isolated fixture',async()=>{const response=await c.request.post(base+'/api/admin/auth/login',{headers:{origin:base},data:{email:account.email,password:account.password,code:code(account.secret),method:'totp'}});assert.equal(response.status(),200);return{status:response.status()};});
  await page.goto(base+'/admin',{waitUntil:'domcontentloaded'});await page.locator('.workspace-redesign-admin').waitFor();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);
   for(const href of ['/admin/lucrari','/admin/clienti','/admin/firme','/admin/suport','/admin/financiar','/admin/marketing','/admin/rapoarte','/admin','/admin/setari']){
    await clickTrace(page,{scope:'admin',href,label:href.split('/').at(-1)||'azi',width});
    if(width===1440&&href==='/admin/suport'){
     await page.locator('#incidente table button').first().waitFor();
     await clickTrace(page,{scope:'admin',href,label:'incident-open',width,targetSelector:'#incidente table button'});
     for(const label of ['Rezumat','Verificare','Rezoluție','Istoric'])await clickTrace(page,{scope:'admin',href,label:'incident-'+label,width,targetSelector:`nav[aria-label="Secțiunile dosarului"] button:has-text("${label}")`});
    }
    if(width===1440&&href==='/admin/marketing'){
     const labels=await page.locator('nav[aria-label="Secțiuni Marketing"] button').allTextContents();
     for(const label of labels)await clickTrace(page,{scope:'admin',href,label:'marketing-'+label,width,targetSelector:`nav[aria-label="Secțiuni Marketing"] button:has-text("${label}")`});
    }
    if(width===1440&&['/admin/setari','/admin/rapoarte','/admin/suport','/admin/financiar'].includes(href)){
     const tabs=await page.locator('.workspace-redesign-section-nav a').evaluateAll(nodes=>nodes.map(node=>({href:node.getAttribute('href'),text:node.textContent})));
     for(const link of tabs)if(link.href){
      const targetSelector=`.workspace-redesign-section-nav a[href="${link.href}"]`;
      if(!await page.locator(targetSelector).count())await clickTrace(page,{scope:'admin',href,label:'return-'+href.split('/').at(-1),width});
      await clickTrace(page,{scope:'admin',href:link.href,label:href.split('/').at(-1)+'-'+link.text,width,targetSelector});
     }
    }
   }
   await page.screenshot({path:path.join(output,`admin-navigation-${width}.png`),fullPage:true});
  }
  await c.close();
 }
 report.summary={transitions:report.navigation.length,transitionsWithMissingShell:report.navigation.filter(trace=>trace.summary.missingWorkspaceFrames>0).length,transitionsWithDocumentReload:report.navigation.filter(trace=>trace.summary.documentReload).length};
 assert.deepEqual(report.pageErrors,[],'Browser runtime errors detected');
 assert.equal(db.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(db.pragma('foreign_key_check'),[]);
 report.status='passed';
}catch(error){report.status='failed';report.failure=error.message;await currentPage?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{
 await browser?.close();db?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);if(server.exitCode===null)server.kill('SIGKILL');}await log?.close();
 report.finishedAt=new Date().toISOString();await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await fs.rm(temporary,{recursive:true,force:true});
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,layouts:report.layouts.length,pageErrors:report.pageErrors.length,failure:report.failure,output}));
}
