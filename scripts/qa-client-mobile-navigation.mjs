/** Exercise the real client UI with intercepted, synthetic account responses only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const repo=path.resolve(new URL('..',import.meta.url).pathname);
const tools=process.env.NITIDO_QA_TOOLS??'/workspace/nitido-qa-tools/node_modules';
const {chromium}=await import(pathToFileURL(path.join(tools,'playwright-core/index.mjs')).href);
const output=process.env.NITIDO_QA_OUTPUT??'/workspace/nitido-operations/navigation-fix-20261010/local';
const base=process.env.NITIDO_QA_BASE??'http://127.0.0.1:3199';
const report={base,scope:'Real browser UI; synthetic intercepted API responses; no real account, booking or payment writes',checks:[],pageErrors:[]};
let server,browser,temporary;
const user={id:'navigation-qa',role:'client',name:'Client Test',email:'navigation@example.test',referral_code:null,credit_balance:0};
const workspace={dailyActions:[],firms:[],inventoryHistory:[],inventory:[],blocks:[],properties:[],teams:[],assignments:[],checklist:[],events:[],hostChecks:[],propertyJobs:[],executionRules:{}};
let jobs=[];
const job={id:'qa-job',client_id:user.id,street:'Adresă de test',postal_code:null,city:'Constanța',floor:null,sqm:75,space_type:'apartament',when_type:'asap',scheduled_at:null,price_gross:300,credit_applied:0,duration_minutes:120,buffer_minutes:0,photos_count:0,status:'waiting',accepted_firm_id:null,accepted_at:null,arrived_confirmed_at:null,completed_at:null,created_at:new Date().toISOString()};
async function check(name,fn){await fn();report.checks.push({name,passed:true});console.log('PASS',name);}
async function fixed(page){await page.waitForFunction(()=>{const n=document.querySelector('.client-mobile-navigation');if(!n)return false;const r=n.getBoundingClientRect();return getComputedStyle(n).position==='fixed'&&Math.abs(r.bottom-innerHeight)<2&&r.top>=0;});assert.equal(await page.locator('.client-mobile-navigation').count(),1);const r=await page.locator('.client-mobile-navigation').boundingBox();assert(r.width<=page.viewportSize().width+1);}
async function tab(page,label){await page.locator('.client-mobile-navigation').getByRole('link',{name:label,exact:true}).click();}
async function section(page,id){await page.locator('#'+id).waitFor({state:'visible'});await page.waitForFunction(id=>{const r=document.getElementById(id)?.getBoundingClientRect();return r&&r.top>=-2&&r.top<innerHeight-80;},id);await fixed(page);}
try{
 await fs.mkdir(output,{recursive:true});
 if(!process.env.NITIDO_QA_BASE){
  temporary=await fs.mkdtemp(path.join(os.tmpdir(),'nitido-navigation-'));
  for(const entry of ['package.json','next.config.ts','tsconfig.json','next-env.d.ts'])await fs.copyFile(path.join(repo,entry),path.join(temporary,entry));
  await fs.symlink(path.join(repo,'node_modules'),path.join(temporary,'node_modules'),'dir');
  await fs.symlink(path.join(repo,'public'),path.join(temporary,'public'),'dir');
  await fs.cp(path.join(repo,'.next'),path.join(temporary,'.next'),{recursive:true,filter:file=>!file.startsWith(path.join(repo,'.next/cache'))&&!file.startsWith(path.join(repo,'.next/standalone'))});
  const env={...process.env,NODE_ENV:'production',NITIDO_SEED_DEMO:'false',NEXT_TELEMETRY_DISABLED:'1'};
  for(const key of Object.keys(env))if(/STRIPE|RESEND|TWILIO|SMS|OPENAI|CRON_SECRET|ACCESS_KEY|NITIDO_ADMIN|TOKEN/.test(key))delete env[key];
  const log=await fs.open(path.join(output,'server.log'),'w');
  server=spawn(process.execPath,[path.join(repo,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3199'],{cwd:temporary,env,stdio:['ignore',log.fd,log.fd]});
  for(let i=0;i<60;i++){try{if((await fetch(base+'/login')).ok)break;}catch{}if(server.exitCode!==null)throw Error('Local server exited');await new Promise(r=>setTimeout(r,500));}
 }
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 await context.route('**/api/**',async route=>{
  const request=route.request(),p=new URL(request.url()).pathname;
  if(request.method()!=='GET'){await route.abort();throw Error('Unexpected API mutation: '+p);}
  let data={};
  if(p==='/api/auth/me'){await new Promise(r=>setTimeout(r,150));data={user,firm:null};}
  else if(p==='/api/auth/verify-email')data={verified:true,configured:true};
  else if(p==='/api/jobs')data={jobs};
  else if(p==='/api/workspace')data=workspace;
  else if(p==='/api/payments/card')data={hasCard:false,cards:[],configured:false};
  else if(p==='/api/recurring')data={plans:[]};
  else if(p==='/api/workspace/messages')data={inbox:[]};
  else if(p==='/api/account/client')data=user;
  else if(p==='/api/account/business')data={profile:{isBusiness:false,companyName:null,companyCui:null,companyAddress:null}};
  else if(p.endsWith('/care'))data={executionItems:[],canConfirm:false,canManage:false,canResolve:false,canReport:false,jobStatus:'waiting',receipt:null,instructions:null,photos:[],cases:[]};
  else if(p.endsWith('/offers'))data={offers:[]};
  else if(p==='/api/jobs/qa-job')data={job,firmName:null};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
 await page.goto(base+'/client');await page.getByRole('heading',{name:/Bună, Client/}).waitFor();
 await check('Acasă and empty Reservations respond to repeated taps',async()=>{await fixed(page);await tab(page,'Rezervări');await section(page,'sec-lucrari');assert(await page.getByText('Nu ai rezervări încă.',{exact:true}).isVisible());await tab(page,'Rezervări');await section(page,'sec-lucrari');await tab(page,'Acasă');await page.waitForFunction(()=>scrollY===0);});
 await check('Tabs restore dashboard sections from the booking form',async()=>{await tab(page,'Rezervări');await page.locator('#sec-lucrari').getByRole('button',{name:'Configurează o rezervare'}).click();await page.getByRole('heading',{name:'Postează o lucrare',exact:true}).waitFor();await fixed(page);await tab(page,'Rezervări');await section(page,'sec-lucrari');assert.equal(await page.getByRole('heading',{name:'Postează o lucrare',exact:true}).count(),0);await tab(page,'Cont');await section(page,'sec-cont');await tab(page,'Acasă');await page.waitForFunction(()=>scrollY===0);});
 await check('Messages keeps the fixed bar while scrolling and returns to Reservations',async()=>{await tab(page,'Mesaje');await page.getByRole('heading',{name:'Conversațiile tale',exact:true}).waitFor();await fixed(page);await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await fixed(page);const last=page.getByRole('link',{name:'Ai nevoie de ajutor? Contactează NITIDO'});await last.scrollIntoViewIfNeeded();const a=await last.boundingBox(),n=await page.locator('.client-mobile-navigation').boundingBox();assert(a.y+a.height<=n.y+1,'Last message link must not be covered by the bar');await page.screenshot({path:path.join(output,'messages-iphone.png')});await tab(page,'Acasă');await page.getByRole('heading',{name:/Bună, Client/}).waitFor();await page.waitForFunction(()=>scrollY===0,{},{timeout:5000});await tab(page,'Mesaje');await page.getByRole('heading',{name:'Conversațiile tale',exact:true}).waitFor();await page.waitForFunction(()=>scrollY===0,{},{timeout:5000});await tab(page,'Rezervări');await section(page,'sec-lucrari');await tab(page,'Mesaje');await page.getByRole('heading',{name:'Conversațiile tale',exact:true}).waitFor();await tab(page,'Cont');await section(page,'sec-cont');});
 await check('Account deep link survives delayed authentication and browser history',async()=>{await page.reload();await section(page,'sec-cont');await tab(page,'Rezervări');await section(page,'sec-lucrari');await tab(page,'Acasă');await page.waitForFunction(()=>scrollY===0);await page.goBack();await section(page,'sec-lucrari');await page.goBack();await section(page,'sec-cont');await page.goForward();await section(page,'sec-lucrari');});
 jobs=[job];
 await check('Reservations with a job and detail view keep working',async()=>{await page.goto(base+'/client#sec-lucrari');await page.reload();await section(page,'sec-lucrari');await page.locator('#sec-lucrari').getByRole('button',{name:/apartament/}).click();await page.locator('.execution-detail').waitFor({state:'visible'});await fixed(page);await tab(page,'Cont');await section(page,'sec-cont');assert.equal(await page.locator('.execution-detail').count(),0);await tab(page,'Rezervări');await section(page,'sec-lucrari');});
 await check('Small phone, landscape and resized viewport keep every tab reachable',async()=>{for(const viewport of [{width:360,height:800},{width:852,height:393},{width:393,height:450}]){await page.setViewportSize(viewport);await tab(page,'Mesaje');await page.getByRole('heading',{name:'Conversațiile tale',exact:true}).waitFor();await fixed(page);await tab(page,'Acasă');await page.getByRole('heading',{name:/Bună, Client/}).waitFor();await fixed(page);}await page.setViewportSize({width:393,height:852});await page.screenshot({path:path.join(output,'dashboard-iphone.png')});});
 await check('Desktop hides the mobile bar',async()=>{const desktop=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});const p=await desktop.newPage();await p.goto(base+'/client');assert.equal(await p.locator('.client-mobile-navigation').isVisible(),false);await desktop.close();});
 assert.deepEqual(report.pageErrors,[],'No browser runtime errors');
 report.passed=true;
}catch(error){report.passed=false;report.error=error.stack;console.error(error);process.exitCode=1;}
finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser?.close();server?.kill();if(temporary)await fs.rm(temporary,{recursive:true,force:true});}
