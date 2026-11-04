import {beforeEach,afterEach,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {customerRecord} from './customerOperations';
import {customerRecordView} from './customerAccess';
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

it('separates foreign value and keeps it behind the existing report permission',()=>{
 job('ro','c','completed',550);job('eu','c','completed',999);
 const snapshot={currency:'EUR',countryCode:'DE',city:'Berlin',tariffId:'synthetic',revision:1,recordedAt:'2026-11-02T10:00:00Z',netMinor:10001,vatMinor:0,vatBps:0,grossMinor:10001,clientTotalMinor:10001,creditMinor:0,durationMinutes:180,workers:1,personMinutes:180,lines:[{code:'cleaning',amountMinor:10001},{code:'vat',amountMinor:0}]};
 db.prepare("UPDATE jobs SET pricing_snapshot=? WHERE id='eu'").run(JSON.stringify(snapshot));
 db.exec("INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,currency,amount_gross_minor,commission_amount_minor,amount_net_minor) VALUES('p','eu',100,18,80,'EUR',10001,1800,8201)");
 const record=customerRecord(db,'c');expect(record.value.completedServiceValueBani).toBe(55000);
 expect(record.jobs.rows).toContainEqual(expect.objectContaining({currency:'EUR',price_gross:100.01}));expect(JSON.stringify(record.jobs.rows)).not.toContain('pricing_snapshot');
 expect(record.payments.rows).toContainEqual(expect.objectContaining({currency:'EUR',amount_gross:100.01}));
 expect(record.value.monetaryByCurrency).toMatchObject({RON:{amountMinor:55000,count:1},EUR:{amountMinor:10001,count:1}});
 expect(record.value.margin).toMatchObject({currency:'RON',excludedOtherCurrencyJobs:1,missingOrIncompleteJobs:1});
 expect(customerRecordView(record,'operator').value.monetaryByCurrency).toBeNull();
 expect(customerRecordView(record,'super_admin').value.monetaryByCurrency?.EUR.amountMinor).toBe(10001);
});
