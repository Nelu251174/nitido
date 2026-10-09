import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {NextRequest} from 'next/server';
const s=vi.hoisted(()=>({db:null as Database.Database|null,actor:'verified' as string|null,audit:vi.fn()}));
vi.mock('@/lib/db',async original=>{const actual=await original<typeof import('@/lib/db')>();return {...actual,get db(){return s.db!;}};});
vi.mock('@/lib/adminAuth',()=>({getAdminActorId:async()=>s.actor,auditAdminAction:s.audit}));
import {initializeDatabase} from '@/lib/db';
import {createAssessment} from '@/lib/assessments';
import {setCatalogFirm} from '@/lib/catalogCapacity';
import {GET,POST} from './route';
let id:string;
const definition=()=>({startsAt:'2026-10-03T07:00:00.000Z',durationMinutes:120,bufferMinutes:30,requiredTeams:1,source:'Evaluare suprafață și fotografii',reason:'Plan renovare'});
const body=(patch:Record<string,unknown>={})=>({id,revision:0,assessmentVersion:1,definition:definition(),...patch});
const request=(b:unknown,origin?:string)=>new NextRequest('https://sandbox.nitido.ro/api/admin/assessment-plans',{method:'POST',headers:origin?{Origin:origin}:{},body:JSON.stringify(b)});
const save=async(patch:Record<string,unknown>={})=>POST(request(body(patch)));
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));s.actor='verified';s.audit.mockReset();
 vi.stubEnv('NITIDO_MANUAL_OFFERS_SANDBOX','true');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('STRIPE_SECRET_KEY','');
 s.db=new Database(':memory:');s.db.pragma('foreign_keys=ON');initializeDatabase(s.db);
 s.db.exec("INSERT INTO users(id,role,name) VALUES('c','client','Client'),('f','firma','Firma');INSERT INTO firms(id,user_id,verified,coverage_city) VALUES('firm','f',1,'București');INSERT INTO workspace_teams(id,firm_id,name,minimum_duration_minutes,travel_minutes) VALUES('t','firm','Echipa 1',0,0),('t2','firm','Echipa 2',0,0)");
 id=createAssessment(s.db,'c','request',{category:'renovation',city:'București',sqm:1800,rooms:10,bathrooms:3,difficulty:'heavy',notes:'Evaluare lucrare complexă',appliances:0,windowsSqm:0,linenSets:0,extraHours:0});
 setCatalogFirm(s.db,'renovation','firm',true);
});
afterEach(()=>{s.db!.close();vi.useRealTimers();vi.unstubAllEnvs();});
function block(start='2026-10-03T09:45:00Z',end='2026-10-03T11:00:00Z'){
 s.db!.prepare("INSERT INTO workspace_team_blocks(id,team_id,starts_at,ends_at,reason,created_by,created_at) VALUES('b','t',?,?,'Indisponibil','f','2026-10-01')").run(start,end);
}
function job(assigned=true){
 s.db!.exec("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,buffer_minutes,status,accepted_firm_id) VALUES('j','c','Test','București',80,'apartament','scheduled','2026-10-03T05:00:00Z',500,60,0,'accepted','firm')");
 if(assigned)s.db!.exec("INSERT INTO workspace_assignments(job_id,team_id,assigned_by,created_at) VALUES('j','t','f','2026-10-01')");
}
describe('operational assessment planning',()=>{
 it('plans renovation and large areas without creating bookings, allocating teams or changing the assessment',async()=>{
  const r=await save();expect(r.status).toBe(200);const {plan}=await r.json();expect(plan.capacity).toMatchObject({category:'renovation',city:'București',eligibleFirms:1,capacityReserved:false});expect(plan.capacity.firms[0].availableTeams).toBe(2);
  expect(s.db!.prepare('SELECT * FROM jobs').all()).toHaveLength(0);expect(s.db!.prepare('SELECT * FROM workspace_assignments').all()).toHaveLength(0);expect(s.db!.prepare('SELECT version FROM service_assessments WHERE id=?').get(id)).toEqual({version:1});
 });
 it('extends the candidate interval using team minimum duration and travel',async()=>{
  s.db!.exec('UPDATE workspace_teams SET minimum_duration_minutes=180,travel_minutes=45 WHERE id=\'t\'');block();
  const {plan}=await (await save()).json();expect(plan.capacity.firms[0].teams[0]).toMatchObject({available:false,endsAt:'2026-10-03T10:45:00.000Z'});expect(plan.capacity.firms[0].availableTeams).toBe(1);
 });
 it('honors existing firm-wide overlap even when another team is free',async()=>{
  job();s.db!.exec("UPDATE workspace_teams SET minimum_duration_minutes=180,travel_minutes=30 WHERE id='t'");
  const {plan}=await (await save()).json();expect(plan.capacity.eligibleFirms).toBe(0);expect(plan.capacity.firms[0].availableTeams).toBe(0);
 });
 it('does not declare malformed or unplanned occupied intervals free',async()=>{
  job(false);s.db!.exec("UPDATE jobs SET scheduled_at=NULL");const {plan}=await (await save()).json();expect(plan.capacity.eligibleFirms).toBe(0);
 });
 it('permits adjacent blocks and ignores canceled ones',async()=>{
  block('2026-10-03T09:30:00Z','2026-10-03T11:00:00Z');let p=await (await save()).json();expect(p.plan.capacity.firms[0].availableTeams).toBe(2);
  s.db!.exec("UPDATE workspace_team_blocks SET starts_at='2026-10-03T07:00:00Z',cancelled=1");p=await (await save({revision:1})).json();expect(p.plan.capacity.firms[0].availableTeams).toBe(2);
 });
 it('records unmet team requirements without pooling unrelated firms or claiming a reservation',async()=>{
  const {plan}=await (await save({definition:{...definition(),requiredTeams:3}})).json();expect(plan.capacity.eligibleFirms).toBe(0);expect(plan.capacity.capacityReserved).toBe(false);
 });
 it.each(['UPDATE firms SET verified=0',"UPDATE firms SET suspended_until='invalid'",'UPDATE service_catalog_firms SET enabled=0','UPDATE workspace_teams SET active=0',"UPDATE firms SET coverage_city='Iași'"])('requires current eligibility: %s',async sql=>{
  s.db!.exec(sql);const {plan}=await (await save()).json();expect(plan.capacity.eligibleFirms).toBe(0);
 });
 it('fails closed for invalid team rules and reversed unavailable periods',async()=>{
  s.db!.exec("UPDATE workspace_teams SET travel_minutes=-1 WHERE id='t'");block('2026-10-03T12:00:00Z','2026-10-03T11:00:00Z');const {plan}=await (await save()).json();expect(plan.capacity.firms[0].teams[0].available).toBe(false);
 });
 it('preserves historical capacity, recalculates on a new revision and guards stale requests',async()=>{
  await save();block('2026-10-03T07:00:00Z');expect((await save()).status).toBe(409);
  const p=await (await save({revision:1})).json();expect(p.plan.capacity.firms[0].availableTeams).toBe(1);
  s.db!.prepare('UPDATE service_assessments SET version=2 WHERE id=?').run(id);expect((await save({revision:2})).status).toBe(409);
  const history=await (await GET(new NextRequest(`https://sandbox.nitido.ro/api/admin/assessment-plans?id=${id}`))).json();expect(history.assessmentVersion).toBe(2);expect(history.plans[1].capacity.firms[0].availableTeams).toBe(2);
 });
 it.each([{durationMinutes:null},{durationMinutes:0},{durationMinutes:1.5},{bufferMinutes:null},{bufferMinutes:-1},{requiredTeams:0},{startsAt:'2026-02-30T07:00:00.000Z'},{startsAt:'2026-09-01T07:00:00.000Z'},{source:''},{reason:''}])('rejects missing or invalid requirements %j',async patch=>{
  expect((await save({definition:{...definition(),...patch}})).status).toBe(400);
 });
 it('requires verified Admin, trusts session identity, and rejects cross-origin and oversized requests',async()=>{
  const p=await (await save({actor:'forged'})).json();expect(p.plan.actor_id).toBe('verified');
  expect((await POST(request(body(),'https://attacker.example'))).status).toBe(403);expect((await POST(request('x'.repeat(10001)))).status).toBe(413);
  s.actor=null;expect((await save()).status).toBe(401);expect((await GET(new NextRequest('https://sandbox.nitido.ro/api/admin/assessment-plans?id=x'))).status).toBe(401);
 });
 it('rolls back plan when audit fails, protects history and blocks closed requests',async()=>{
  s.audit.mockImplementation(()=>{throw Error('audit');});expect((await save()).status).toBe(500);expect(s.db!.prepare('SELECT * FROM assessment_plans').all()).toHaveLength(0);
  s.audit.mockReset();await save();expect(()=>s.db!.exec('DELETE FROM assessment_plans')).toThrow(/retained/);expect(()=>s.db!.exec('UPDATE assessment_plans SET revision=2')).toThrow(/immutable/);
  s.db!.prepare("UPDATE service_assessments SET status='cancelled' WHERE id=?").run(id);expect((await save({revision:1})).status).toBe(409);
 });
 it('rejects live or disabled mutation contexts',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://nitido.ro');expect((await save()).status).toBe(403);vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('STRIPE_SECRET_KEY','rk_live_example');expect((await save()).status).toBe(403);
 });
});
