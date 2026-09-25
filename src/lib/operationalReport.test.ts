import {beforeEach,afterEach,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {operationalReport} from './operationalReport';
import {COST_CODES,emptyManualEstimate} from './operationalMargin';
let db:Database.Database;
const period={from:'2026-09-01',to:'2026-09-30'};
beforeEach(()=>{db=new Database(':memory:');db.pragma('foreign_keys=ON');initializeDatabase(db);db.exec(`INSERT INTO users(id,role,name) VALUES('c','client','Client'),('c2','client','Alt client'),('p','firma','Prestator'),('p2','firma','Alt prestator');INSERT INTO firms(id,user_id,coverage_city) VALUES('f','p','București'),('f2','p2','București');`);});
afterEach(()=>db.close());
function job(id:string,date='2026-09-15T10:00:00Z',status='completed'){db.prepare(`INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id,created_at,mode) VALUES(?,'c','Test','București',80,'apartament','scheduled',500,120,?,'f',?,'standard')`).run(id,status,date);}
function complaint(id:string,jobId:string){db.prepare(`INSERT INTO visit_cases(id,job_id,opened_by,request_key,category,description,created_at,updated_at) VALUES(?,?,'c',?,'quality','Test',?,?)`).run(id,jobId,id,'2026-09-20','2026-09-20');}
function review(id:string,caseId:string,outcome:string,date:string){db.prepare('INSERT INTO visit_case_reviews(id,case_id,outcome,note,actor_id,created_at) VALUES(?,?,?,\'Dovezi verificate\',\'admin\',?)').run(id,caseId,outcome,date);}
function cost(jobId:string,revision:number,state='confirmed'){
 const d=emptyManualEstimate();d.lines=[{label:'Curățenie',amountBani:50000}];d.platformDiscountBani=5000;d.reason='Exemplu documentat';
 const known={amountBani:0,state:'confirmed' as const,source:'Document test',recordedAt:'2026-09-20T10:00:00Z'};
 d.provider={...known,amountBani:41000};for(const c of COST_CODES)d.costs[c]={...known,bearer:'platform',includedInProvider:false};
 if(state==='estimated')d.provider.state='estimated';
 db.prepare('INSERT INTO job_actual_costs VALUES(?,?,?,?,?)').run(jobId,revision,JSON.stringify(d),'admin','2026-09-20');
}
it.each([['2026-03-29','2026-03-28T22:00:00Z','2026-03-29T21:00:00Z'],['2026-10-25','2026-10-24T21:00:00Z','2026-10-25T22:00:00Z']])('uses Romanian day boundaries including DST: %s',(day,start,end)=>{
 job('before',new Date(Date.parse(start)-1).toISOString());job('start',start);job('last',new Date(Date.parse(end)-1).toISOString());job('after',end);
 expect(operationalReport(db,{from:day,to:day}).total).toBe(2);
});
it('combines filters and never interprets input as SQL',()=>{job('j');job('other');db.exec("UPDATE jobs SET city='Cluj',mode='express',space_type='casa',client_id='c2',accepted_firm_id='f2' WHERE id='other'");expect(operationalReport(db,{...period,city:'Cluj',mode:'express',space:'casa',client:'c2',firm:'f2'}).total).toBe(1);expect(operationalReport(db,{...period,city:"' OR 1=1 --"}).total).toBe(0);});
it('reports current states within the creation cohort and leaves unknowns unknown',()=>{job('j');job('waiting',undefined,'waiting');db.exec("UPDATE jobs SET accepted_firm_id=NULL WHERE id='waiting'");const r=operationalReport(db,period);expect(r).toMatchObject({total:2,completed:1,waiting:1,observationOnly:true});expect(r.margin).toMatchObject({totalBani:null,missingOrIncompleteJobs:1});expect(r.providers[0]).toMatchObject({averageRating:null,arrivalSamples:0,score:null,automaticAllocation:false});expect(operationalReport(db,{from:'2025-01-01',to:'2025-01-02'}).margin.totalBani).toBeNull();});
it('uses latest review, deduplicates complaint jobs and excludes unresolved allegations from confirmed counts',()=>{job('j');job('pending');complaint('a','j');complaint('b','j');complaint('c','pending');review('r1','a','confirmed','2026-09-20');review('r2','b','confirmed','2026-09-20');expect(operationalReport(db,period)).toMatchObject({confirmedComplaintJobs:1,unreviewedComplaintJobs:1});review('r3','a','not_confirmed','2026-09-21');review('r4','b','needs_information','2026-09-21');expect(operationalReport(db,period)).toMatchObject({confirmedComplaintJobs:0,unreviewedComplaintJobs:2});});
it('counts only published, active ratings matching the completed job and parties',()=>{for(const id of ['good','hidden','wrong','unfinished'])job(id,undefined,id==='unfinished'?'accepted':'completed');const insert=db.prepare(`INSERT INTO ratings(id,job_id,firm_id,client_id,stars,status,moderation_status) VALUES(?,?,?,'c',?,'active',?)`);insert.run('r1','good','f',5,'published');insert.run('r2','hidden','f',1,'hidden');insert.run('r3','wrong','f2',1,'published');insert.run('r4','unfinished','f',1,'published');expect(operationalReport(db,period).providers[0]).toMatchObject({ratingCount:1,averageRating:5});});
it('requires both valid proof types from the assigned firm and real arrival samples',()=>{job('j');job('j2');db.exec("UPDATE jobs SET scheduled_at='2026-09-15T12:00:00Z',arrived_confirmed_at='2026-09-15T11:59:00Z' WHERE id='j'");const p=db.prepare(`INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,status) VALUES(?,?,'p',?,?,? ,?)`);p.run('a','j','f','ARRIVAL','a','VALID');p.run('b','j','f','COMPLETION','b','VALID');p.run('c','j2','f','ARRIVAL','c','VALID');p.run('d','j2','f2','COMPLETION','d','VALID');p.run('e','j2','f','COMPLETION','e','REJECTED');expect(operationalReport(db,period).providers[0]).toMatchObject({completedWithBothProofs:1,arrivalSamples:1,arrivedByScheduled:1});});
it('uses latest cost revision, preserves discount once and never presents partial margin as total',()=>{job('j');cost('j',1,'estimated');cost('j',2);expect(operationalReport(db,period).margin).toMatchObject({totalBani:4000,confirmedJobs:1,estimatedJobs:0});job('missing');job('estimated');cost('estimated',1,'estimated');expect(operationalReport(db,period).margin).toMatchObject({totalBani:null,knownConfirmedBani:4000,confirmedJobs:1,estimatedJobs:1,missingOrIncompleteJobs:1});});
it('does not mutate provider state, jobs or cost history',()=>{job('j');cost('j',1);const tables=['jobs','firms','job_actual_costs'];const snapshot=()=>tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all());const before=snapshot();operationalReport(db,period);expect(snapshot()).toEqual(before);});
it('rejects invalid dates, ranges and modes',()=>{for(const patch of [{from:'2026-02-30'},{from:'invalid'},{from:'2026-10-01'},{from:'2024-01-01'},{mode:'pro'},{space:'unknown'}])expect(()=>operationalReport(db,{...period,...patch})).toThrow();});
it('refuses a truncated report',()=>{db.transaction(()=>{for(let i=0;i<10001;i++)job('j'+i);})();expect(()=>operationalReport(db,period)).toThrow(/10.000/);});
it('calculates medians, explicit denominators and lifetime service value without guessing acceptance',()=>{
 job('earlier','2026-08-01T10:00:00Z');job('one','2026-09-01T10:00:00Z');job('two','2026-09-02T10:00:00Z');job('cancelled','2026-09-03T10:00:00Z','cancelled');
 db.exec("UPDATE jobs SET accepted_at='2026-09-01 10:10:00' WHERE id='one';UPDATE jobs SET accepted_at='2026-09-02 10:30:00' WHERE id='two'");
 const r=operationalReport(db,period);expect(r.kpis.allocation).toEqual({minutes:20,samples:2});expect(r.kpis.cancellation).toMatchObject({numerator:1,denominator:3});expect(r.kpis.repeatOrders).toEqual({numerator:2,denominator:2,percent:100});expect(r.kpis.lifetime).toMatchObject({clients:1,completedJobs:3,serviceValueBani:150000});expect(r.kpis.averageOrderBani).toBe(50000);expect(r.kpis.providerAcceptance.percent).toBeNull();
});
it('filters by frozen service and recorded postal zone without reclassifying legacy work',()=>{
 job('one');job('legacy');db.exec("UPDATE jobs SET postal_code='010101' WHERE id='one';INSERT INTO job_execution_rules VALUES('one','general',1,'[]','2026-09-01')");
 expect(operationalReport(db,{...period,service:'general',zone:'010101'}).total).toBe(1);expect(operationalReport(db,{...period,service:'legacy'}).total).toBe(1);expect(operationalReport(db,{...period,zone:"' OR 1=1 --"}).total).toBe(0);expect(operationalReport(db,{...period,firm:'f'}).kpis.requests).toBeNull();
});
it('counts unconverted assessment requests in conversion denominator',()=>{
 db.prepare('INSERT INTO service_assessments VALUES(?,?,?,?,?,?,?,?,?)').run('a','c','key',JSON.stringify({category:'general',city:'București'}),1,'{}','submitted',1,'2026-09-01T10:00:00Z');
 expect(operationalReport(db,{...period,city:'București',service:'general'}).kpis.requests).toMatchObject({total:1,converted:0,percent:0,offerMedianMinutes:null});
 expect(operationalReport(db,{...period,city:'Cluj'}).kpis.requests).toMatchObject({total:0,percent:null});
});
