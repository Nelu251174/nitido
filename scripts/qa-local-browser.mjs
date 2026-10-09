/** Local synthetic acceptance only. No deployment, production data or external payments. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const repo = path.resolve(new URL('..', import.meta.url).pathname);
const require = createRequire(path.join(repo, 'package.json'));
const Database = require('better-sqlite3'), bcrypt = require('bcryptjs'), ts = require('typescript');
const { chromium } = await import(pathToFileURL(process.env.NITIDO_QA_PLAYWRIGHT ?? '/workspace/nitido-qa-tools/node_modules/playwright-core/index.mjs').href);
const output = path.resolve(process.env.NITIDO_QA_OUTPUT ?? '/workspace/nitido-qa-results');
const productionBuild = process.env.NITIDO_QA_BUILD_PATH;
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'nitido-browser-'));
await fs.mkdir(output, {recursive:true});
const cronSecret=randomBytes(32).toString('hex');
const widths = [360,390,430,768,1024,1440], port = 3197, base = `http://localhost:${port}`;
const report = {scope:`Local isolated Next ${productionBuild?'production':'development'} server, synthetic SQLite, real MFA login; no hosting or device acceptance`,started:new Date().toISOString(),checks:[],layouts:[],pageErrors:[],developmentRetries:[]};
const roles = ['operator','manager','finance','super_admin'];
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes) {let acc=0,bits=0,text='';for(const byte of bytes){acc=(acc<<8)|byte;bits+=8;while(bits>=5){bits-=5;text+=alphabet[(acc>>>bits)&31];acc&=(1<<bits)-1;}}if(bits)text+=alphabet[(acc<<(5-bits))&31];return text;}
const accounts = roles.map(role=>{const secret=randomBytes(20);return {role,email:`${role}@example.test`,password:randomBytes(24).toString('hex'),secret,totpSecret:base32(secret)};});
function totp(secret){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const d=createHmac('sha1',secret).update(counter).digest();return String((d.readUInt32BE(d[d.length-1]&15)&0x7fffffff)%1000000).padStart(6,'0');}
let server,browser,db;
async function check(name,fn){try{const details=await fn();report.checks.push({name,passed:true,details});}catch(e){report.checks.push({name,passed:false,error:e.message});throw e;}}
async function get(context,url){for(let attempt=0;attempt<3;attempt++){const response=await context.request.get(base+url),raw=await response.text();if(response.status()===500&&raw.includes('Manifest file is empty')&&attempt<2){report.developmentRetries.push({url,status:500,error:'Manifest file is empty'});await new Promise(r=>setTimeout(r,500));continue;}let data;try{data=JSON.parse(raw);}catch{throw Error(`${url}: HTTP ${response.status()} did not return JSON`);}return {status:response.status(),data};}}
async function layout(page,label){
 await page.waitForTimeout(500);
 for(const width of widths){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(180);
  const dimensions=await page.evaluate(()=>{
   const main=document.querySelector('main')??document.body;
   const overflowing=[main,...main.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1);});
   const inBoundedScroller=element=>{for(let ancestor=element.parentElement;ancestor&&ancestor!==document.body&&ancestor!==document.documentElement;ancestor=ancestor.parentElement){const r=ancestor.getBoundingClientRect(),overflow=getComputedStyle(ancestor).overflowX;if(['auto','scroll'].includes(overflow)&&r.left>=-1&&r.right<=innerWidth+1)return true;}return false;};
   const describe=e=>({tag:e.tagName,text:e.textContent?.slice(0,60),right:Math.round(e.getBoundingClientRect().right)});
   const uncontained=overflowing.filter(e=>!inBoundedScroller(e));
   return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,mainBackground:getComputedStyle(main).backgroundColor,offenders:overflowing.slice(0,8).map(describe),uncontainedOverflowCount:uncontained.length,uncontainedOffenders:uncontained.slice(0,8).map(describe)};
  });
  report.layouts.push({label,...dimensions,passed:dimensions.scrollWidth<=width+1&&dimensions.uncontainedOverflowCount===0});
  await page.screenshot({path:path.join(output,`${label}-${width}.png`)});
 }
}
async function dashboardAcceptance(context,page,label,financial,propertyCount=2){
 await check(`${label} consolidated Pro dashboard and CSV preserve scope`,async()=>{
  const day=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Bucharest'});
  const result=await get(context,`/api/pro/dashboard?organization_id=qa-org&from=${day}&to=${day}`);
  assert.equal(result.status,200);assert.equal(result.data.properties.total,propertyCount);
  assert.equal(Boolean(result.data.clientCosts),financial);assert.equal(result.data.pagination.aggregatesCoverAllAuthorizedProperties,true);
  assert(!JSON.stringify(result.data).includes('Adresă privată'));
  if(financial){assert.equal(result.data.clientCosts.registry.totalBani,10000);assert.equal(result.data.clientCosts.completedWork.totalBani,null);assert.equal(result.data.clientCosts.completedWork.unknownWorks,1);
   const csv=await context.request.get(`${base}/api/pro/reports/export?organization_id=qa-org&from=${day}&to=${day}`);assert.equal(csv.status(),200);const body=await csv.text();assert(body.includes('10.00')&&body.includes('90.00'));
  }else{assert(result.data.propertyRows.every(row=>row.clientCosts===null));assert(!('internalMargin'in result.data));}
  await page.goto(base+'/pro/dashboard',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Portofoliu consolidat',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Costuri aprobate pentru client',exact:true}).count(),financial?1:0);
  if(financial)assert(await page.getByText('Necunoscut',{exact:true}).count()>0);
  const dimensions=await page.evaluate(()=>{const stat=document.querySelector('.pro-stat strong'),label=document.querySelector('.pro-stat span'),card=document.querySelector('.pro-card');return{statFont:parseFloat(getComputedStyle(stat).fontSize),labelFont:parseFloat(getComputedStyle(label).fontSize),cardPadding:parseFloat(getComputedStyle(card).paddingLeft),cardBackground:getComputedStyle(card).backgroundColor};});
  assert(dimensions.statFont>=24&&dimensions.labelFont>=12&&dimensions.cardPadding>=16);assert.equal(dimensions.cardBackground,'rgb(247, 243, 236)');
  return{propertyCount,financial,period:result.data.period,knownRegistryBani:financial?result.data.clientCosts.registry.totalBani:null,unknownFinalCosts:financial?1:null,...dimensions};
 });
 await layout(page,`dashboard-${label}`);
}


async function incidentQualificationAcceptance(context,page,role,assessmentId,startsAt){
 await check(`${role} SLA inbox uses nominal roles, current deadlines and versioned acknowledgement`,async()=>{
  const select=page.getByLabel('Alege dosarul · pagina 1');await select.waitFor();await select.selectOption('qa-sla-pickup');
  await page.getByRole('heading',{name:'Alerte interne SLA',exact:true}).waitFor();
  const pickup=await get(context,'/api/admin/incident-alerts?caseId=qa-sla-pickup');assert.equal(pickup.status,200);
  if(role==='operator'){
   assert.equal(pickup.data.alerts.length,1);const alert=pickup.data.alerts[0];
   await page.getByText('Preluarea acestei escaladări este rezervată managerului operațional.',{exact:true}).waitFor();
   const denied=await context.request.post(base+'/api/admin/incident-alerts',{headers:{origin:base},data:{alertId:alert.id,caseRevision:alert.caseRevision,note:'Tentativă sintetică Operator; trebuie refuzată'}});assert.equal(denied.status(),403);
   await select.selectOption('qa-sla-provider');await page.getByText('Răspuns prestator întârziat',{exact:true}).waitFor();
   const provider=await get(context,'/api/admin/incident-alerts?caseId=qa-sla-provider');assert.equal(provider.data.alerts.length,1);const providerAlert=provider.data.alerts[0];
   await page.getByLabel('Notă internă de preluare').fill('Urmărire prestator, exclusiv fixture locală QA');
   const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/incident-alerts'&&r.request().method()==='POST');await page.getByRole('button',{name:'Preia alerta',exact:true}).click();assert.equal((await saved).status(),200);
   await page.getByText('Nu există alerte interne active de preluat.',{exact:true}).waitFor();
   assert.equal(db.prepare('SELECT actor_id FROM incident_sla_acknowledgements WHERE alert_id=?').get(providerAlert.id).actor_id,'qa-operator');
   const replay=await context.request.post(base+'/api/admin/incident-alerts',{headers:{origin:base},data:{alertId:providerAlert.id,caseRevision:providerAlert.caseRevision,note:'Urmărire prestator, exclusiv fixture locală QA'}});assert.equal(replay.status(),200);assert.equal((await replay.json()).replayed,true);
   assert.equal(db.prepare("SELECT COUNT(*) n FROM admin_audit_log WHERE action='incident.sla.acknowledge' AND target_id='qa-sla-provider'").get().n,1);
   return{managementAckStatus:denied.status(),providerAckStatus:200,nominalActor:'qa-operator',replayed:true,caseStatus:db.prepare("SELECT status FROM visit_cases WHERE id='qa-sla-provider'").get().status};
  }
  assert.equal(pickup.data.alerts.length,1);const alert=pickup.data.alerts[0];
  const stale=await context.request.post(base+'/api/admin/incident-alerts',{headers:{origin:base},data:{alertId:alert.id,caseRevision:'stale',note:'Versiune sintetică veche'}});assert.equal(stale.status(),409);
  await page.getByLabel('Notă internă de preluare').fill('Escaladare preluată de Manager, exclusiv fixture locală QA');
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/incident-alerts'&&r.request().method()==='POST');await page.getByRole('button',{name:'Preia alerta',exact:true}).click();assert.equal((await saved).status(),200);
  await page.getByText('Nu există alerte interne active de preluat.',{exact:true}).waitFor();
  assert.equal(db.prepare('SELECT actor_id FROM incident_sla_acknowledgements WHERE alert_id=?').get(alert.id).actor_id,'qa-manager');assert.equal(db.prepare("SELECT status FROM visit_cases WHERE id='qa-sla-pickup'").get().status,'open');
  return{managementAckStatus:200,staleVersionStatus:stale.status(),nominalActor:'qa-manager',caseRemainsOpen:true};
 });
 await check(`${role} verifies prospective plan qualification through real form with version checks`,async()=>{
  const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Pregătire operațională pentru plan',exact:true})}).last();await section.getByLabel('Motivul verificării interne').waitFor();
  const initial=await get(context,'/api/admin/assessment-qualification?id='+encodeURIComponent(assessmentId));assert.equal(initial.status,200);assert.equal(initial.data.tracked,true);
  const submit=async(note,state)=>{await section.getByLabel('Motivul verificării interne').fill(note);const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/assessment-qualification'&&r.request().method()==='POST');await section.getByRole('button',{name:'Reverifică planul, capacitatea și dovezile',exact:true}).click();assert.equal((await saved).status(),200);const read=await get(context,'/api/admin/assessment-qualification?id='+encodeURIComponent(assessmentId));assert.equal(read.data.state,state);await section.getByText(({ready:'Criteriile planului erau îndeplinite la verificare',unavailable:'Capacitate indisponibilă pentru planul verificat',pending:'Pregătire încă neverificată sau incompletă'})[state],{exact:true}).waitFor();return read.data;};
  if(role==='operator'){
   assert.equal(initial.data.revision,0);const state=await submit('Verificare Operator a planului sintetic și capacității locale','ready');assert.equal(state.revision,1);assert.equal(state.last.actor_id,'qa-operator');assert.equal(state.observation.snapshot.capacity.capacityReserved,false);
   const stale=await context.request.post(base+'/api/admin/assessment-qualification',{headers:{origin:base},data:{id:assessmentId,revision:0,assessmentVersion:1,reason:'Reîncercare QA cu versiune veche'}});assert.equal(stale.status(),409);
   db.prepare("INSERT INTO workspace_team_blocks(id,team_id,starts_at,ends_at,reason,created_by,created_at) VALUES('qa-qualification-block','qa-service-team',?,?,?,'qa-provider',?)").run(startsAt,new Date(Date.parse(startsAt)+4*3600000).toISOString(),'Blocaj sintetic QA pentru schimbarea capacității',new Date().toISOString());
   const changed=await get(context,'/api/admin/assessment-qualification?id='+encodeURIComponent(assessmentId));assert.equal(changed.data.state,'pending');assert.equal(changed.data.stale,true);
   await section.getByRole('button',{name:'Actualizează verificarea',exact:true}).click();await section.getByText('verificarea anterioară nu mai corespunde datelor curente',{exact:false}).waitFor();
   return{initialRevision:0,savedRevision:1,savedState:'ready',changedState:changed.data.state,stale:true,staleSaveStatus:409,nominalActor:state.last.actor_id,capacityReserved:false};
  }
  assert.equal(initial.data.stale,true);assert.equal(initial.data.revision,1);const blocked=await submit('Manager reverifică blocajul sintetic de capacitate','unavailable');assert.equal(blocked.revision,2);assert.equal(blocked.last.actor_id,'qa-manager');
  db.prepare("UPDATE workspace_team_blocks SET cancelled=1 WHERE id='qa-qualification-block'").run();await section.getByRole('button',{name:'Actualizează verificarea',exact:true}).click();await section.getByText('verificarea anterioară nu mai corespunde datelor curente',{exact:false}).waitFor();
  const restored=await submit('Manager reverifică după retragerea blocajului sintetic','ready');assert.equal(restored.revision,3);
  const stale=await context.request.post(base+'/api/admin/assessment-qualification',{headers:{origin:base},data:{id:assessmentId,revision:2,assessmentVersion:1,reason:'Versiune veche QA'}});assert.equal(stale.status(),409);
  const day=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Bucharest'});const cohort=await get(context,`/api/admin/assessment-qualification?from=${day}&to=${day}&client=qa-owner`);assert.equal(cohort.status,200);assert.equal(cohort.data.counts.total,1);assert.equal(cohort.data.counts.ready,1);assert.equal(cohort.data.eligibleConversion.percent,null);
  await page.getByRole('button',{name:'Calculează cohorta completă',exact:true}).click();await page.getByText(cohort.data.eligibleConversion.reason,{exact:true}).waitFor();
  return{blockedRevision:2,restoredRevision:3,staleSaveStatus:409,nominalActor:restored.last.actor_id,cohortTotal:1,cohortReady:1,commercialConversion:null};
 });
 await layout(page,`${role}-sla-qualification`);
}

try{
 for(const entry of await fs.readdir(repo)){if(['src','public'].includes(entry)||/^(package.*\.json|next.*\.(js|mjs|ts)|tsconfig\.json|postcss.*|next-env\.d\.ts)$/.test(entry))await fs.cp(path.join(repo,entry),path.join(temporary,entry),{recursive:true});}
 await fs.symlink(path.join(repo,'node_modules'),path.join(temporary,'node_modules'),'dir');
 if(productionBuild){const source=path.resolve(productionBuild);await fs.cp(source,path.join(temporary,'.next'),{recursive:true,filter:file=>!file.startsWith(path.join(source,'cache'))&&!file.startsWith(path.join(source,'standalone'))});report.buildId=(await fs.readFile(path.join(temporary,'.next/BUILD_ID'),'utf8')).trim();}
 const bootstrap=accounts.find(a=>a.role==='super_admin');
 const env={...process.env,NODE_ENV:productionBuild?'production':'development',NEXT_TELEMETRY_DISABLED:'1',NITIDO_SEED_DEMO:'false',NITIDO_PRO_ENABLED:'true',NEXT_PUBLIC_NITIDO_PRO_PUBLIC:'true',NEXT_PUBLIC_SITE_URL:base,NITIDO_ADMIN_EMAIL:bootstrap.email,NITIDO_ADMIN_PASSWORD_HASH:await bcrypt.hash(bootstrap.password,10),NITIDO_ADMIN_TOTP_SECRET:bootstrap.totpSecret,NITIDO_ADMIN_STAFF_ACCOUNTS_JSON:JSON.stringify(await Promise.all(accounts.filter(a=>a.role!=='super_admin').map(async a=>({email:a.email,passwordHash:await bcrypt.hash(a.password,10),totpSecret:a.totpSecret}))))};
 // Do not inherit service credentials into a synthetic browser run.
 for(const key of Object.keys(env))if(/STRIPE|RESEND|TWILIO|SMS|OPENAI|CRON_SECRET|ACCESS_KEY/.test(key))delete env[key];
 // Ephemeral local-only activation; never inherited from hosting or written to the report.
 env.CRON_SECRET=cronSecret;env.NITIDO_INCIDENT_SLA_ALERTS_ENABLED='true';
 const log=await fs.open(path.join(output,'server.log'),'w');
 server=spawn(process.execPath,[path.join(repo,'node_modules/next/dist/bin/next'),productionBuild?'start':'dev',...(productionBuild?[]:['--webpack']),'--hostname','localhost','--port',String(port)],{cwd:temporary,env,stdio:['ignore',log.fd,log.fd]});
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(server.exitCode!==null)throw Error(`Next server exited ${server.exitCode}`);try{const r=await fetch(base+'/api/admin/auth/me',{signal:AbortSignal.timeout(2000)});if(r.status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}assert(ready,'Local server did not initialize');
 db=new Database(path.join(temporary,'data/nitido.db'));db.pragma('foreign_keys=ON');
 for(const a of accounts.filter(a=>a.role!=='super_admin'))db.prepare('INSERT INTO admin_staff VALUES(?,?,?,?,?)').run(`qa-${a.role}`,a.email,a.role,1,1);
 const schema=ts.transpileModule(await fs.readFile(path.join(temporary,'src/lib/pro/schema.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 await fs.writeFile(path.join(temporary,'qa-pro-schema.mjs'),schema);const {migratePro}=await import(pathToFileURL(path.join(temporary,'qa-pro-schema.mjs')).href);migratePro(db);
 db.prepare("INSERT INTO users(id,role,name,email) VALUES('qa-viewer','client','QA scoped viewer','viewer@example.test')").run();
 db.prepare("INSERT INTO pro_organizations VALUES('qa-org','Portofoliu sintetic','Constanța','active',0,1,'QA-NONCOMMERCIAL',?)").run(new Date().toISOString());
 for(const [id,name,address] of [['qa-visible','Proprietate permisă','Adresă privată permisă'],['qa-hidden','Proprietate interzisă','Adresă privată interzisă']])db.prepare('INSERT INTO pro_properties(id,organization_id,name,city,address) VALUES(?,?,?,?,?)').run(id,'qa-org',name,'Constanța',address);
 db.prepare(`INSERT INTO pro_work_orders(id,organization_id,property_id,title,service,status,starts_at,ends_at,threshold_snapshot,estimate,financial_status,checklist_json,created_by,created_at) VALUES('qa-work','qa-org','qa-visible','Intervenție sintetică','cleaning_recurring','scheduled',?,?,0,1000,'not_required','["Verificare sintetică"]','qa-viewer',?)`).run(new Date(Date.now()+3600000).toISOString(),new Date(Date.now()+7200000).toISOString(),new Date().toISOString());
 db.prepare("INSERT INTO pro_work_photo_rules VALUES('qa-work',1,2)").run();
 db.prepare("INSERT INTO pro_members VALUES('qa-viewer-member','qa-org','qa-viewer','viewer','[\"qa-visible\"]',1)").run();
 db.prepare("INSERT INTO users(id,role,name,email) VALUES('qa-owner','client','QA Owner','owner@example.test')").run();
 db.prepare("INSERT INTO pro_members VALUES('qa-owner-member','qa-org','qa-owner','owner','[]',1)").run();
 db.prepare(`INSERT INTO pro_work_orders(id,organization_id,property_id,title,service,status,starts_at,ends_at,threshold_snapshot,estimate,financial_status,checklist_json,created_by,created_at) VALUES('qa-missing-final','qa-org','qa-visible','Cost final necunoscut sintetic','cleaning_recurring','completed',?,?,0,1000,'not_required','[]','qa-owner',?)`).run(new Date().toISOString(),new Date(Date.now()+3600000).toISOString(),new Date().toISOString());
 for(const [id,property,amount]of [['qa-cost-visible','qa-visible',1000],['qa-cost-hidden','qa-hidden',9000]])db.prepare("INSERT INTO pro_cost_entries(id,organization_id,property_id,category,amount,created_at) VALUES(?,'qa-org',?,'cleaning_recurring',?,?)").run(id,property,amount,new Date().toISOString());
 const viewerToken=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)').run(viewerToken,'qa-viewer',new Date(Date.now()+3600000).toISOString());
 const ownerToken=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)').run(ownerToken,'qa-owner',new Date(Date.now()+3600000).toISOString());
 // Synthetic marketplace cases and capacity are isolated from every Pro fixture and payment.
 const incidentCreated=new Date(Date.now()-4*3600000).toISOString(),incidentPicked=new Date(Date.now()-2*3600000).toISOString(),planStartsAt=new Date(Date.now()+3*86400000).toISOString();
 db.prepare("INSERT INTO users(id,role,name,email) VALUES('qa-provider','firma','Prestator sintetic QA','provider@example.test')").run();
 db.prepare("INSERT INTO firms(id,user_id,verified,coverage_city) VALUES('qa-service-firm','qa-provider',1,'Constanța')").run();
 db.prepare("INSERT INTO workspace_teams(id,firm_id,name,minimum_duration_minutes,travel_minutes) VALUES('qa-service-team','qa-service-firm','Echipă sintetică',0,0)").run();
 db.prepare("INSERT INTO service_catalog_firms(category_key,firm_id,enabled) VALUES('maintenance','qa-service-firm',1)").run();
 db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id,created_at) VALUES('qa-sla-job','qa-owner','Adresă privată sintetică','Constanța',80,'apartament','scheduled',500,120,'completed','qa-service-firm',?)").run(incidentCreated);
 db.prepare("INSERT INTO incident_sla_policy VALUES(1,30,60,240,'Valori arbitrare exclusiv pentru fixture locală QA','qa-manager',?)").run(incidentCreated);
 for(const id of ['qa-sla-pickup','qa-sla-provider'])db.prepare("INSERT INTO visit_cases(id,job_id,opened_by,request_key,category,description,created_at,updated_at) VALUES(?,'qa-sla-job','qa-owner',?,'quality','Sesizare sintetică fără plată reală',?,?)").run(id,id,incidentCreated,incidentCreated);
 db.prepare("INSERT INTO incident_triage VALUES('qa-sla-provider',1,'normal','Operator sintetic QA','Notă internă sintetică',1,?,?,?,'qa-manager',?)").run(incidentPicked,new Date(Date.parse(incidentPicked)+3600000).toISOString(),new Date(Date.parse(incidentPicked)+4*3600000).toISOString(),incidentPicked);
 const sweep=await fetch(base+'/api/cron/incident-sla',{method:'POST',headers:{'x-cron-secret':cronSecret}});assert.equal(sweep.status,200);assert.equal((await sweep.json()).created,2);
 report.migrations=db.prepare('SELECT version FROM pro_schema_migrations ORDER BY version').all().map(r=>r.version);
 browser=await chromium.launch({executablePath:process.env.NITIDO_QA_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 async function context(){const c=await browser.newContext({locale:'ro-RO',timezoneId:'Europe/Bucharest'});await c.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());return c;}
 const fixtureClient=await context();await fixtureClient.addCookies([{name:'nitido_session',value:ownerToken,url:base,httpOnly:true,sameSite:'Lax'}]);
 const createdAssessment=await fixtureClient.request.post(base+'/api/assessments',{headers:{origin:base},data:{action:'create',requestKey:'qa-prospective-browser',input:{category:'maintenance',city:'Constanța',sqm:80,rooms:2,bathrooms:1,difficulty:'normal',notes:'Cerere prospectivă sintetică QA, fără ofertă sau plată',appliances:0,windowsSqm:0,linenSets:0,extraHours:0}}});assert.equal(createdAssessment.status(),200);const qualificationId=(await createdAssessment.json()).id;await fixtureClient.close();
 const planDefinition={startsAt:planStartsAt,durationMinutes:120,bufferMinutes:30,requiredTeams:1,source:'Durată sintetică verificată QA',reason:'Plan sintetic QA, nu rezervare de capacitate'};
 const fixtureCapacity={checkedAt:new Date().toISOString(),category:'maintenance',city:'Constanța',startsAt:planStartsAt,requestedEndsAt:new Date(Date.parse(planStartsAt)+150*60000).toISOString(),requiredTeams:1,eligibleFirms:1,capacityReserved:false,firms:[{id:'qa-service-firm',name:'Prestator sintetic QA',eligible:true,availableTeams:1,reasons:[],teams:[{teamId:'qa-service-team',available:true,endsAt:new Date(Date.parse(planStartsAt)+150*60000).toISOString(),reason:null}]}]};
 db.prepare('INSERT INTO assessment_plans VALUES(?,1,1,?,?,?,?)').run(qualificationId,JSON.stringify(planDefinition),JSON.stringify(fixtureCapacity),'qa-manager',new Date().toISOString());
 const anonymous=await context(),publicPage=await anonymous.newPage();publicPage.on('pageerror',e=>report.pageErrors.push({label:'public',error:e.message}));await publicPage.goto(base,{waitUntil:'domcontentloaded'});await layout(publicPage,'public');await anonymous.close();
 for(const a of accounts){const c=await context();await check(`${a.role} authenticates through password + TOTP`,async()=>{const login=await c.request.post(base+'/api/admin/auth/login',{headers:{origin:base},data:{email:a.email,password:a.password,code:totp(a.secret),method:'totp'}});assert.equal(login.status(),200);const me=await get(c,'/api/admin/auth/me');assert.equal(me.data.identity.role,a.role);return {loginStatus:login.status(),identityRole:me.data.identity.role};});
  await check(`${a.role} admin permissions`,async()=>{const result={};for(const [endpoint,allowed] of [['workbench',true],['incident-alerts',a.role!=='finance'],['assessment-qualification?id='+encodeURIComponent(qualificationId),a.role!=='finance'],['overview',a.role==='super_admin'],['execution-templates',['manager','super_admin'].includes(a.role)],['operational-report?from=2026-10-01&to=2026-10-09',a.role!=='operator']]){const r=await get(c,`/api/admin/${endpoint}`);assert.equal(r.status===200,allowed,`${endpoint}: ${r.status}`);result[endpoint]=r.status;}return result;});
  await check(`${a.role} Pro internal read permissions`,async()=>{const ctx=await get(c,'/api/pro/context');assert.equal(ctx.status,200);assert.equal(ctx.data.internal_role,a.role);const cost=await get(c,'/api/pro/costs?organization_id=qa-org');assert.equal(cost.status===200,a.role!=='operator');const property=await get(c,'/api/pro/properties/qa-visible');assert.equal(property.status,200);assert.equal('address'in property.data,a.role!=='finance');return {costStatus:cost.status,propertyAddressVisible:'address'in property.data};});
  const page=await c.newPage();page.on('pageerror',e=>report.pageErrors.push({label:a.role,error:e.message}));await page.goto(base+'/admin',{waitUntil:'domcontentloaded'});await (a.role==='super_admin'?page.getByRole('heading',{name:'Centrul de operațiuni'}):page.getByRole('button',{name:'Închide sesiunea'})).waitFor({timeout:30000});
  if(a.role==='manager'){await page.getByRole('button',{name:'Încarcă sau reîncarcă listele'}).click();await page.getByLabel('Minimum la sosire').waitFor();await check('Manager photo rule editor persists revised synthetic policy',async()=>{await page.getByLabel('Minimum la sosire').fill('2');await page.getByLabel('Minimum la finalizare').fill('3');await page.getByLabel('Motivul modificării',{exact:true}).fill('Validare locală pe date sintetice');await page.getByRole('button',{name:'Publică lista pentru lucrările noi'}).click();await page.getByText('Lista a fost publicată pentru lucrările create de acum înainte.').waitFor();const r=await get(c,'/api/admin/execution-templates');assert(r.data.templates.some(t=>t.revision===1&&t.photoRules.arrivalMin===2&&t.photoRules.completionMin===3));return {arrivalMin:2,completionMin:3};});
   await check('Manager configures Provider Score through real observation-only form on synthetic DB',async()=>{await page.getByRole('button',{name:'Încarcă regulile și rezultatele'}).click();await page.getByLabel('Perioadă în zile').fill('30');await page.getByLabel('Minimum lucrări finalizate').fill('1');await page.getByLabel('Minimum măsurători pe componentă').fill('1');for(const [name,value]of Object.entries({rating:100,punctuality:0,reliability:0,complaintFree:0,evidence:0}))await page.locator(`input[name="${name}"]`).fill(String(value));await page.getByLabel('Motivul regulii').fill('Ponderi arbitrare exclusiv pentru fixture QA sintetic; nu constituie politică comercială.');await page.getByRole('button',{name:'Salvează pentru observare'}).click();await page.getByText('Regula a fost salvată pentru observare.').waitFor();const score=await get(c,'/api/admin/provider-score');assert.equal(score.status,200);assert.equal(score.data.policy.definition.mode,'observation');assert.equal(score.data.automaticAllocation,false);return {path:'UI /admin → Provider Score; POST/GET /api/admin/provider-score',mode:score.data.policy.definition.mode,automaticAllocation:score.data.automaticAllocation,syntheticWeightsOnly:true};});
  }
  if(['operator','manager'].includes(a.role))await incidentQualificationAcceptance(c,page,a.role,qualificationId,planStartsAt);
  await layout(page,a.role);
  await check(`${a.role} Pro work detail renders its redacted payload`,async()=>{await page.goto(base+'/pro/lucrari/qa-work',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Intervenție sintetică'}).waitFor();const detail=await get(c,'/api/pro/work-orders/qa-work');assert.equal(detail.status,200);assert.equal('checklist_json'in detail.data,a.role!=='finance');assert.equal('estimate'in detail.data,a.role!=='operator');return {checklistVisible:'checklist_json'in detail.data,estimateVisible:'estimate'in detail.data};});
  await layout(page,`pro-${a.role}`);
  await dashboardAcceptance(c,page,a.role,a.role!=='operator');
  if(a.role==='manager')await check('Manager creates, pauses and resumes daily recurrence through Pro calendar UI',async()=>{await page.goto(base+'/pro/calendar',{waitUntil:'domcontentloaded'});const details=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Adaugă regulă recurentă'})});await details.locator('summary').click();const form=details.locator('form');await form.locator('[name="property_id"]').selectOption('qa-visible');await form.locator('[name="title"]').fill('Recurență zilnică sintetică');await form.locator('[name="service"]').selectOption('cleaning_recurring');await form.locator('[name="frequency"]').selectOption('daily');const day=offset=>new Date(Date.now()+offset*86400000).toLocaleDateString('sv-SE',{timeZone:'Europe/Bucharest'});await form.locator('[name="start_date"]').fill(day(1));await form.locator('[name="end_date"]').fill(day(3));await form.locator('[name="hour"]').fill('10');await form.locator('[name="duration"]').fill('60');await form.locator('[name="estimate"]').fill('1000');await form.getByRole('button',{name:'Adaugă regulă recurentă'}).click();await page.getByText('Operațiunea a fost confirmată.',{exact:true}).waitFor();const readRule=async()=>{const r=await get(c,'/api/pro/recurring?organization_id=qa-org');assert.equal(r.status,200);return r.data.find(rule=>rule.title==='Recurență zilnică sintetică');};let rule=await readRule();assert.equal(rule.frequency,'daily');assert.equal(rule.active,1);await page.getByRole('button',{name:'Pauză',exact:true}).click();await page.getByRole('button',{name:'Reia',exact:true}).waitFor();rule=await readRule();assert.equal(rule.active,0);await page.getByRole('button',{name:'Reia',exact:true}).click();await page.getByRole('button',{name:'Pauză',exact:true}).waitFor();rule=await readRule();assert.equal(rule.active,1);assert.equal(rule.frequency,'daily');await page.screenshot({path:path.join(output,'manager-daily-recurrence.png')});return {path:'UI /pro/calendar → POST /api/pro/recurring → POST /api/pro/recurring/:id (pause/resume) → GET /api/pro/recurring',frequency:rule.frequency,pauseActive:0,resumeActive:rule.active,generatedOccurrences:db.prepare('SELECT COUNT(*) AS total FROM pro_occurrences WHERE rule_id=?').get(rule.id).total};});
  await c.close();
 }
 const viewer=await context();await viewer.addCookies([{name:'nitido_session',value:viewerToken,url:base,httpOnly:true,sameSite:'Lax'}]);
 await check('Scoped Pro viewer cannot see other property, private address or finance',async()=>{const list=await get(viewer,'/api/pro/properties?organization_id=qa-org');assert.equal(list.status,200);assert.deepEqual(list.data.map(p=>p.id),['qa-visible']);const visible=await get(viewer,'/api/pro/properties/qa-visible');assert.equal(visible.status,200);assert.equal('address'in visible.data,false);const hidden=await get(viewer,'/api/pro/properties/qa-hidden');assert.equal(hidden.status,404);const costs=await get(viewer,'/api/pro/costs?organization_id=qa-org');assert([403,404].includes(costs.status));return {propertyCount:list.data.length,hiddenStatus:hidden.status,costStatus:costs.status};});
 const page=await viewer.newPage();page.on('pageerror',e=>report.pageErrors.push({label:'pro-viewer',error:e.message}));await page.goto(base+'/pro/proprietati',{waitUntil:'domcontentloaded'});await page.getByText('Proprietate permisă',{exact:true}).waitFor();await layout(page,'pro-viewer');await dashboardAcceptance(viewer,page,'viewer',false,1);await viewer.close();
 const owner=await context();await owner.addCookies([{name:'nitido_session',value:ownerToken,url:base,httpOnly:true,sameSite:'Lax'}]);const ownerPage=await owner.newPage();ownerPage.on('pageerror',e=>report.pageErrors.push({label:'pro-owner',error:e.message}));await dashboardAcceptance(owner,ownerPage,'owner',true);await check('Pro Owner dashboard never receives internal margin',async()=>{const r=await get(owner,'/api/pro/dashboard?organization_id=qa-org');assert.equal(r.status,200);assert(!('internalMargin'in r.data));return{internalMarginVisible:false};});await owner.close();
 report.finished=new Date().toISOString();report.passed=report.checks.every(c=>c.passed)&&report.layouts.every(l=>l.passed)&&report.pageErrors.length===0;if(!report.passed)process.exitCode=1;
}catch(e){report.failure=e.message;report.passed=false;process.exitCode=1;}finally{await browser?.close();db?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);if(server.exitCode===null)server.kill('SIGKILL');}await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,passed:report.passed,checks:report.checks.length,layouts:report.layouts.length,pageErrors:report.pageErrors.length,failure:report.failure}));await fs.rm(temporary,{recursive:true,force:true});}
