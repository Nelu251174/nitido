import {afterEach,beforeEach,expect,it} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {changeVisitCare,readVisitCare} from './visitCare';
let db:Database.Database;
beforeEach(()=>{
 db=new Database(':memory:');initializeDatabase(db);
 db.exec("INSERT INTO users(id,role,name) VALUES('c','client','Synthetic client'),('u','firma','Synthetic firm');INSERT INTO firms(id,user_id,coverage_city,verified) VALUES('f','u','Berlin',1)");
 const snapshot={currency:'EUR',countryCode:'DE',city:'Berlin',tariffId:'synthetic',revision:1,recordedAt:new Date().toISOString(),netMinor:10000,vatMinor:2000,vatBps:2000,grossMinor:12000,creditMinor:0,clientTotalMinor:12000,durationMinutes:180,workers:1,personMinutes:180,lines:[{code:'cleaning',amountMinor:10000},{code:'vat',amountMinor:2000}]};
 db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id,completed_at,pricing_snapshot) VALUES('j','c','Synthetic street','Berlin',70,'apartament','scheduled',120,180,'completed','f',?,?)").run(new Date().toISOString(),JSON.stringify(snapshot));
});
afterEach(()=>db.close());
it('retains complaint access but prevents automatic foreign remedial visit from becoming a RON contract',()=>{
 const result=changeVisitCare(db,'j',{id:'c',role:'client'},{action:'open',requestKey:'synthetic-complaint',category:'quality',description:'Synthetic quality complaint'}) as {id:string};
 const care=readVisitCare(db,'j',{id:'c',role:'client'});expect(care.cases).toHaveLength(1);
 const revision=(db.prepare('SELECT updated_at FROM visit_cases WHERE id=?').get(result.id) as {updated_at:string}).updated_at;
 for(const [action,user] of [['propose',{id:'u',role:'firma'}],['accept',{id:'c',role:'client'}]] as const){
  try{changeVisitCare(db,'j',user,{action,caseId:result.id,revision,note:'Synthetic proposal'});throw Error('unexpected success');}catch(error){expect(error).toMatchObject({status:422});}
 }
 expect(db.prepare('SELECT COUNT(*) n FROM jobs').get()).toEqual({n:1});
 expect(db.prepare('SELECT COUNT(*) n FROM visit_case_events').get()).toEqual({n:1});
 expect(db.prepare('SELECT COUNT(*) n FROM payments').get()).toEqual({n:0});
});
it('does not expose the complaint to another account',()=>{
 expect(()=>readVisitCare(db,'j',{id:'other',role:'client'})).toThrow('Acces interzis.');
});
