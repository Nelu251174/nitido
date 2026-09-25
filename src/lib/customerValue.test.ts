import {beforeEach,afterEach,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {customerRecord} from './customerOperations';
import {COST_CODES,emptyManualEstimate} from './operationalMargin';
let db:Database.Database;
beforeEach(()=>{db=new Database(':memory:');initializeDatabase(db);db.exec("INSERT INTO users(id,role,name) VALUES('c','client','Client'),('other','client','Other')");});afterEach(()=>db.close());
function job(id:string,client='c',status='completed',gross=500){db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status) VALUES(?,?,'Test','București',80,'apartament','scheduled',?,120,?)").run(id,client,gross,status);}
function cost(id:string,revision:number,provider:number|null){const d=emptyManualEstimate();d.lines=[{label:'Serviciu',amountBani:50000}];d.reason='Confirmare';if(provider!==null)d.provider={amountBani:provider,state:'confirmed',source:'Contract',recordedAt:'2026-09-25'};for(const code of COST_CODES)d.costs[code]={...d.costs[code],amountBani:0,state:'confirmed',source:'Verificat',recordedAt:'2026-09-25'};db.prepare('INSERT INTO job_actual_costs VALUES(?,?,?,?,?)').run(id,revision,JSON.stringify(d),'admin','2026-09-25');}
it('aggregates the entire relationship independently of history pagination and isolates other clients',()=>{
 for(let i=0;i<51;i++)job('job'+i);job('foreign','other');job('cancelled','c','cancelled');
 const record=customerRecord(db,'c',50);expect(record.jobs.rows).toHaveLength(2);expect(record.value).toMatchObject({totalJobs:52,completedJobs:51,completedServiceValueBani:2550000});expect(record.value.margin).toMatchObject({totalBani:null,confirmedJobs:0,missingOrIncompleteJobs:51});
});
it('counts only the latest cost revision, retains unknowns and shows a total only with full confirmation',()=>{
 job('a');job('b');cost('a',1,30000);cost('a',2,40000);cost('b',1,null);
 expect(customerRecord(db,'c').value.margin).toMatchObject({knownConfirmedBani:10000,confirmedJobs:1,missingOrIncompleteJobs:1,totalBani:null});
 cost('b',2,30000);expect(customerRecord(db,'c').value.margin).toMatchObject({totalBani:30000,confirmedJobs:2,missingOrIncompleteJobs:0});
});
it('keeps empty history and confirmed losses distinct from unknown margins',()=>{
 expect(customerRecord(db,'c').value).toMatchObject({totalJobs:0,completedJobs:0,completedServiceValueBani:0,margin:{totalBani:null}});
 job('loss');cost('loss',1,60000);expect(customerRecord(db,'c').value.margin.totalBani).toBe(-10000);
});
