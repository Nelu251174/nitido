import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NextRequest} from 'next/server';
const s=vi.hoisted(()=>({db:null as Database.Database|null,user:'c',actor:'admin' as string|null,audit:vi.fn(),authorize:vi.fn()}));
vi.mock('@/lib/db',async original=>{const actual=await original<typeof import('@/lib/db')>();return {...actual,get db(){return s.db!;},getFirmByUserId:(id:string)=>s.db!.prepare('SELECT * FROM firms WHERE user_id=?').get(id)};});
vi.mock('@/lib/auth',()=>({getCurrentUser:async()=>s.db!.prepare('SELECT * FROM users WHERE id=?').get(s.user)}));
vi.mock('@/lib/adminAuth',()=>({getAdminActorId:async()=>s.actor,auditAdminAction:s.audit}));
vi.mock('@/lib/payments',()=>({authorizePayment:s.authorize,connectTransfersEnabled:()=>false}));
vi.mock('@/lib/clientPayments',()=>({getClientCardInfo:()=>({stripeConfigured:false,hasCard:false})}));
vi.mock('@/lib/push',()=>({queueNewJobFirmPushes:()=>[],processPushOutbox:vi.fn()}));
import {initializeDatabase} from '@/lib/db';
import {createAssessment} from '@/lib/assessments';
import {attachAssessmentPhoto,reviewAssessmentEvidence} from '@/lib/assessmentEvidence';
import {saveManualEstimate} from '@/lib/manualEstimates';
import {saveMarginPolicy} from '@/lib/marginPolicy';
import {publishManualOffer,decideManualOffer} from '@/lib/manualOffers';
import {COST_CODES,emptyManualEstimate} from '@/lib/operationalMargin';
import {calcNetForFirm} from '@/lib/pricing';
import {saveAssessmentPlan} from '@/lib/assessmentPlan';
import {setCatalogFirm} from '@/lib/catalogCapacity';
import {acceptJobAtomic} from '@/lib/acceptJob';
import {assignTeam} from '@/lib/workspace';
import {POST,GET} from './route';
import {POST as propose} from '../admin/assisted-operations/route';
let folder:string,file:string;
const now=new Date('2026-10-01T06:00:00.000Z');
const definition={startsAt:'2026-10-03T07:00:00.000Z',durationMinutes:360,bufferMinutes:45,requiredTeams:1,source:'Mesurare și fotografii',reason:'Plan intern'};
const request=(body:unknown,url='/api/jobs',origin?:string)=>new NextRequest('https://sandbox.nitido.ro'+url,{method:'POST',headers:origin?{Origin:origin}:{},body:JSON.stringify(body)});
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(now);folder=mkdtempSync(join(tmpdir(),'nitido-allocation-'));file=join(folder,'db.sqlite');s.db=new Database(file);s.db.pragma('foreign_keys=ON');initializeDatabase(s.db);s.user='c';s.actor='admin';s.audit.mockReset();s.authorize.mockReset();s.authorize.mockResolvedValue(undefined);
 for(const k of ['NITIDO_MANUAL_OFFERS_SANDBOX','NITIDO_MANUAL_OFFER_BOOKING_SANDBOX'])vi.stubEnv(k,'true');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('STRIPE_SECRET_KEY','');
 s.db.exec("INSERT INTO users(id,role,name) VALUES('c','client','Client'),('other','client','Other'),('u1','firma','Firma 1'),('u2','firma','Firma 2');INSERT INTO firms(id,user_id,verified,coverage_city) VALUES('f1','u1',1,'București'),('f2','u2',1,'București');INSERT INTO workspace_teams(id,firm_id,name,minimum_duration_minutes,travel_minutes) VALUES('t1','f1','Echipa 1',0,0),('t2','f2','Echipa 2',0,0),('t3','f1','Echipa 3',0,0)");
 for(const key of ['renovation','general'])for(const f of ['f1','f2'])setCatalogFirm(s.db,key,f,true);
 saveMarginPolicy(s.db,{revision:0,minBani:0,minBasisPoints:null,reason:'Test'},'admin');
});
afterEach(()=>{s.db!.close();rmSync(folder,{recursive:true,force:true});vi.useRealTimers();vi.unstubAllEnvs();});
function offer(category='renovation',sqm=1800,teams=1){
 const db=s.db!,id=createAssessment(db,'c',crypto.randomUUID(),{category,city:'București',sqm,rooms:10,bathrooms:3,difficulty:'heavy',notes:'Evaluare',appliances:0,windowsSqm:0,linenSets:0,extraHours:0});let version=1;
 if(category==='renovation'){const photo=crypto.randomUUID();db.prepare("INSERT INTO job_photos(id,owner_user_id,filename,validated_at) VALUES(?,'c','private.jpg',?)").run(photo,now.toISOString());attachAssessmentPhoto(db,id,'c',photo);version=2;reviewAssessmentEvidence(db,{id,version,decision:'approved',reason:'Verificat'},'admin');}
 const d=emptyManualEstimate();d.lines=[{label:'Serviciu evaluat',amountBani:50000}];d.reason='Calcul intern';d.provider={amountBani:calcNetForFirm(500)*100,state:'confirmed',source:'Regula existentă',recordedAt:now.toISOString()};for(const c of COST_CODES)d.costs[c]={...d.costs[c],amountBani:0,state:'confirmed',source:'Confirmat',recordedAt:now.toISOString()};saveManualEstimate(db,{id,revision:0,assessmentVersion:version,definition:d},'admin');
 const o=publishManualOffer(db,{id,revision:1,scope:'Servicii complexe conform evaluării. '.repeat(20),expiresAt:'2026-10-02T06:00:00Z',reason:'Test',policyRevision:1},'admin');decideManualOffer(db,'c',{id:o.id,action:'accept',confirmed:true,totalBani:50000});
 db.transaction(()=>saveAssessmentPlan(db,{id,revision:0,assessmentVersion:version,definition:{...definition,requiredTeams:teams}},'admin')).immediate();return o;
}
const proposal=(id:string,patch:Record<string,unknown>={})=>({id,revision:0,planRevision:1,teamId:'t1',expiresAt:'2026-10-02T06:00:00.000Z',reason:'Motiv intern privat',...patch});
const bookBody=(o:ReturnType<typeof offer>,patch:Record<string,unknown>={})=>({manualOfferId:o.id,assistedRevision:1,manualBookingConfirmed:true,confirmedManualTotalBani:50000,city:'București',sqm:o.terms.context.sqm,windowsSqm:0,street:'Adresă test',postalCode:'010101',spaceType:'apartament',mode:'express',whenType:'scheduled',scheduledDate:'2026-10-03',scheduledHour:10,photoIds:[],...patch});
async function ready(){const o=offer();const p=await propose(request(proposal(o.id),'/api/admin/assisted-operations'));expect(p.status).toBe(200);const b=await POST(request(bookBody(o)));expect(b.status).toBe(201);return {o,job:(await b.json()).job};}
it('connects renovation offer, frozen operational duration and actual team allocation without changing the payment call',async()=>{
 const {o,job}=await ready();expect(job.duration_minutes).toBe(360);expect(job.buffer_minutes).toBe(45);expect(job.scheduled_at).toBe(definition.startsAt);expect(job.details).toBe(o.terms.scope);expect(job.status).toBe('waiting');expect(s.db!.prepare('SELECT * FROM workspace_assignments').all()).toHaveLength(0);expect(s.authorize).not.toHaveBeenCalled();
 expect(await acceptJobAtomic(s.db!,job.id,'f1')).toEqual({ok:true});expect(s.db!.prepare('SELECT team_id FROM workspace_assignments WHERE job_id=?').get(job.id)).toEqual({team_id:'t1'});expect(s.authorize).toHaveBeenCalledTimes(1);expect(s.authorize.mock.calls[0].slice(1,5)).toEqual([job.id,500,null,0]);
 expect(job.pricing_snapshot).not.toMatch(/Motiv intern|Mesurare|Calcul intern/);expect(s.db!.prepare("SELECT COUNT(*) n FROM workspace_audit WHERE action='team.assisted_reserved'").get()).toEqual({n:1});
});
it('serializes overlapping acceptances across two SQLite connections while the first payment is pending',async()=>{
 const a=await ready(),b=await ready();let finish!:()=>void;s.authorize.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
 const first=acceptJobAtomic(s.db!,a.job.id,'f1');const secondDb=new Database(file);secondDb.pragma('foreign_keys=ON');try{const second=await acceptJobAtomic(secondDb,b.job.id,'f1');expect(second).toMatchObject({ok:false,code:'CAPACITY_UNAVAILABLE'});expect(secondDb.prepare('SELECT * FROM workspace_assignments').all()).toHaveLength(1);expect(s.authorize).toHaveBeenCalledTimes(1);finish();expect(await first).toEqual({ok:true});}finally{secondDb.close();}
});
it('rejects another firm and rolls back the tentative accepted state before payment',async()=>{
 const {job}=await ready();expect(await acceptJobAtomic(s.db!,job.id,'f2')).toMatchObject({ok:false,status:403});expect(s.db!.prepare('SELECT status,accepted_firm_id FROM jobs WHERE id=?').get(job.id)).toEqual({status:'waiting',accepted_firm_id:null});expect(s.db!.prepare('SELECT * FROM workspace_assignments').all()).toHaveLength(0);expect(s.authorize).not.toHaveBeenCalled();
});
it('releases only the failed claim allocation and allows a later retry',async()=>{
 const {job}=await ready();s.authorize.mockRejectedValueOnce(Error('test decline'));expect(await acceptJobAtomic(s.db!,job.id,'f1')).toMatchObject({ok:false,status:502});expect(s.db!.prepare('SELECT * FROM workspace_assignments').all()).toHaveLength(0);expect(await acceptJobAtomic(s.db!,job.id,'f1')).toEqual({ok:true});
});
it('does not release a newer claim when an earlier authorization fails late',async()=>{
 const {job}=await ready();let decline!:(e:Error)=>void;s.authorize.mockImplementationOnce(()=>new Promise<void>((_,reject)=>{decline=reject;}));
 const first=acceptJobAtomic(s.db!,job.id,'f1');s.db!.prepare("UPDATE job_acceptance_claims SET token='newer-claim' WHERE job_id=?").run(job.id);decline(Error('late decline'));expect(await first).toMatchObject({ok:false,status:502});
 expect(s.db!.prepare('SELECT status FROM jobs WHERE id=?').get(job.id)).toEqual({status:'accepted'});expect(s.db!.prepare('SELECT team_id FROM workspace_assignments WHERE job_id=?').get(job.id)).toEqual({team_id:'t1'});
});
it('rechecks capacity after proposal and before creating a client booking',async()=>{
 const o=offer();await propose(request(proposal(o.id),'/api/admin/assisted-operations'));s.db!.exec("INSERT INTO workspace_team_blocks(id,team_id,starts_at,ends_at,reason,created_by,created_at) VALUES('b','t1','2026-10-03T08:00:00Z','2026-10-03T09:00:00Z','Indisponibil','u1','2026-10-01')");
 expect((await POST(request(bookBody(o)))).status).toBe(409);expect(s.db!.prepare('SELECT * FROM jobs').all()).toHaveLength(0);
});
it('rolls back status, assignment and claim if allocation audit fails',async()=>{
 const {job}=await ready();s.db!.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON workspace_audit BEGIN SELECT RAISE(ABORT,'audit fail'); END;");expect(await acceptJobAtomic(s.db!,job.id,'f1')).toMatchObject({ok:false,status:503});expect(s.db!.prepare('SELECT status FROM jobs WHERE id=?').get(job.id)).toEqual({status:'waiting'});expect(s.db!.prepare('SELECT * FROM workspace_assignments').all()).toHaveLength(0);expect(s.authorize).not.toHaveBeenCalled();
});
it.each(["UPDATE workspace_teams SET active=0 WHERE id='t1'","UPDATE firms SET verified=0 WHERE id='f1'","UPDATE service_catalog_firms SET enabled=0 WHERE firm_id='f1'","INSERT INTO workspace_team_blocks(id,team_id,starts_at,ends_at,reason,created_by,created_at) VALUES('b','t1','2026-10-03T08:00:00Z','2026-10-03T09:00:00Z','Indisponibil','u1','2026-10-01')"])('rechecks eligibility and capacity at acceptance: %s',async sql=>{
 const {job}=await ready();s.db!.exec(sql);expect((await acceptJobAtomic(s.db!,job.id,'f1')).ok).toBe(false);expect(s.db!.prepare('SELECT * FROM workspace_assignments').all()).toHaveLength(0);expect(s.authorize).not.toHaveBeenCalled();
});
it('blocks changed plan and tampered client revision before booking, and never silently uses ASAP',async()=>{
 const o=offer();await propose(request(proposal(o.id),'/api/admin/assisted-operations'));for(const patch of [{assistedRevision:9},{scheduledHour:12},{whenType:'asap'},{manualBookingConfirmed:false}])expect((await POST(request(bookBody(o,patch)))).status).toBe(409);
 s.db!.transaction(()=>saveAssessmentPlan(s.db!,{id:o.assessmentId,revision:1,assessmentVersion:2,definition},'admin')).immediate();expect((await POST(request(bookBody(o)))).status).toBe(409);
});
it('keeps confirmed booking historical after later assessment changes and replays only its owner',async()=>{
 const {o,job}=await ready();s.db!.prepare('UPDATE service_assessments SET version=version+1 WHERE id=?').run(o.assessmentId);expect((await POST(request(bookBody(o)))).status).toBe(200);expect(await acceptJobAtomic(s.db!,job.id,'f1')).toEqual({ok:true});s.user='other';expect((await POST(request(bookBody(o)))).status).toBe(404);
});
it('does not send the opportunity to another firm feed, or leak the client address before acceptance',async()=>{
 const {job}=await ready();s.user='u2';let r=await GET(new NextRequest('https://sandbox.nitido.ro/api/jobs'));expect(await r.text()).not.toContain(job.id);s.user='u1';r=await GET(new NextRequest('https://sandbox.nitido.ro/api/jobs'));const text=await r.text();expect(text).toContain(job.id);expect(text).toContain('Echipa 1');expect(text).not.toContain('Adresă test');
});
it('does not allow replacing the team from the client-confirmed plan through ordinary assignment',async()=>{
 const {job}=await ready();await acceptJobAtomic(s.db!,job.id,'f1');expect(()=>assignTeam(s.db!,'u1','t3',job.id)).toThrow(/reconfirmarea/);
});
it('blocks multi-team plans, expired proposals and revoked renovation evidence',async()=>{
 const multi=offer('general',1800,2);expect((await propose(request(proposal(multi.id),'/api/admin/assisted-operations'))).status).toBe(422);
 const o=offer();await propose(request(proposal(o.id),'/api/admin/assisted-operations'));reviewAssessmentEvidence(s.db!,{id:o.assessmentId,version:2,decision:'rejected',reason:'Reverificare'},'admin');expect((await POST(request(bookBody(o)))).status).toBe(422);
 const p=offer('general');await propose(request(proposal(p.id),'/api/admin/assisted-operations'));vi.setSystemTime(new Date('2026-10-02T06:00:00Z'));expect((await POST(request(bookBody(p)))).status).toBe(409);
});
it('guards administrative access, CSRF, optimistic revision and rollback',async()=>{
 const o=offer();s.actor=null;expect((await propose(request(proposal(o.id)))).status).toBe(401);s.actor='admin';expect((await propose(request(proposal(o.id),'/api/admin/assisted-operations','https://attacker.example'))).status).toBe(403);
 s.audit.mockImplementation(()=>{throw Error('audit');});expect((await propose(request(proposal(o.id)))).status).toBe(500);expect(s.db!.prepare('SELECT * FROM assisted_offer_plans').all()).toHaveLength(0);s.audit.mockReset();await propose(request(proposal(o.id)));expect((await propose(request(proposal(o.id)))).status).toBe(409);
});
it('hides targeted assisted preview from another firm and rechecks team eligibility',async()=>{
 const {canPreviewOpportunity}=await import('@/lib/opportunityEligibility');
 const {job}=await ready();expect(canPreviewOpportunity(s.db!,'f1',job)).toBe(true);expect(canPreviewOpportunity(s.db!,'f2',job)).toBe(false);
 s.db!.exec("UPDATE workspace_teams SET active=0 WHERE id='t1'");expect(canPreviewOpportunity(s.db!,'f1',job)).toBe(false);
 s.db!.exec("UPDATE workspace_teams SET active=1 WHERE id='t1';UPDATE service_catalog_firms SET enabled=0 WHERE firm_id='f1'");expect(canPreviewOpportunity(s.db!,'f1',job)).toBe(false);
});
it('filters suspended firms from the opportunities feed without reserving work',async()=>{
 const {job}=await ready();s.user='u1';let response=await GET(new NextRequest('https://sandbox.nitido.ro/api/jobs'));expect(response.status).toBe(200);expect(JSON.stringify(await response.json())).toContain(job.id);
 s.db!.exec("UPDATE firms SET suspended_until='2099-12-01' WHERE id='f1'");response=await GET(new NextRequest('https://sandbox.nitido.ro/api/jobs'));expect(response.status).toBe(200);expect(JSON.stringify(await response.json())).not.toContain(job.id);expect(s.authorize).not.toHaveBeenCalled();
});
