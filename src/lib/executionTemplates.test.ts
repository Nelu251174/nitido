import {beforeEach,afterEach,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {executionTemplate,saveExecutionTemplate,freezeExecutionRules,jobExecutionRules} from './executionTemplates';
import {setChecklist} from './workspace';
import {markCompletedWithProof} from './proofOfWork';
import {submitExecutionReport,executionReportRecord} from './collaborationAccess';
import {changeVisitCare} from './visitCare';
let db:Database.Database;
beforeEach(()=>{db=new Database(':memory:');db.pragma('foreign_keys=ON');initializeDatabase(db);db.exec("INSERT INTO users(id,role,name) VALUES('c','client','Client'),('u','firma','Firma');INSERT INTO firms(id,user_id,coverage_city,verified) VALUES('f','u','București',1)");});
afterEach(()=>db.close());
function job(id:string){db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id) VALUES(?,'c','Test','București',80,'apartament','scheduled',500,120,'arrived','f')").run(id);}
const publish=(revision=0,scope='standard',items=[{key:'inspection',label:'Verificare materiale delicate'}])=>db.transaction(()=>saveExecutionTemplate(db,{scope,revision,reason:'Test',items},'admin')).immediate();
function freeze(id:string,parent?:string){db.transaction(()=>freezeExecutionRules(db,id,'standard',parent)).immediate();}
function photo(id:string,type:string){db.prepare("INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,mime_type,file_size,status,validated_at) VALUES(?,'new','u','f',?,'test.jpg','image/jpeg',100,'VALID',datetime('now'))").run(id,type);}
it('preserves legacy jobs and freezes current rules on new jobs across publication and remediation',()=>{
 job('legacy');publish();job('new');freeze('new');publish(1,'standard',[{key:'second',label:'Second'}]);job('repair');freeze('repair','new');
 expect(jobExecutionRules(db,'legacy')).toMatchObject({scope:'legacy',revision:0});expect(jobExecutionRules(db,'legacy').items).toHaveLength(6);
 expect(jobExecutionRules(db,'new').revision).toBe(1);expect(jobExecutionRules(db,'repair')).toEqual(jobExecutionRules(db,'new'));freeze('new');expect(jobExecutionRules(db,'new').revision).toBe(1);
 expect(executionTemplate(db,'standard').revision).toBe(2);expect(executionTemplate(db,'express').revision).toBe(0);
 expect(()=>db.exec('UPDATE job_execution_rules SET revision=99')).toThrow(/immutable/);expect(()=>db.exec('DELETE FROM execution_templates')).toThrow(/retained/);
 initializeDatabase(db);expect(jobExecutionRules(db,'new').revision).toBe(1);
});
it('rejects stale publication and invalid keys, duplicate tasks, empty lists or missing reasons',()=>{
 publish();expect(()=>publish()).toThrow(/modificată/);
 for(const items of [[],[{key:'same',label:'A'},{key:'same',label:'B'}],[{key:'bad key',label:'Text'}],[{key:'ok',label:' '}],Array.from({length:41},(_,i)=>({key:'k'+i,label:'Task'}))])expect(()=>publish(1,'standard',items)).toThrow();
 expect(()=>publish(0,'unknown')).toThrow(/invalid/);
 expect(()=>saveExecutionTemplate(db,{},'admin')).toThrow(/Tranzacție/);
 expect(()=>db.transaction(()=>saveExecutionTemplate(db,{scope:'standard',revision:1,reason:'',items:[{key:'a',label:'A'}]},'admin'))()).toThrow(/Motiv/);
 expect(db.prepare('SELECT COUNT(*) n FROM execution_templates').get()).toEqual({n:1});
});
it('uses the frozen list for checklist writes, immutable reports and completion gates',()=>{
 publish();job('new');freeze('new');photo('arrival','ARRIVAL');photo('completion','COMPLETION');
 expect(markCompletedWithProof(db,'new','f','u')).toMatchObject({ok:false,status:409});
 expect(()=>setChecklist(db,'u','new','kitchen',true)).toThrow(/invalidă/);
 expect(()=>submitExecutionReport(db,'u','new','Note')).toThrow(/verificările/);
 setChecklist(db,'u','new','inspection',true);submitExecutionReport(db,'u','new','Note');
 expect(executionReportRecord(db,'new')!.evidence!.checklist).toEqual([{key:'inspection',label:'Verificare materiale delicate',done:true}]);
 expect(markCompletedWithProof(db,'new','f','u')).toEqual({ok:true});
});
it('keeps an unavailable custom task uncompleted and rejects unauthorized checklist changes',()=>{
 publish(0,'standard',[{key:'delicate',label:'Materiale delicate'}]);job('new');freeze('new');photo('arrival','ARRIVAL');photo('completion','COMPLETION');
 setChecklist(db,'u','new','delicate',true);
 changeVisitCare(db,'new',{id:'u',role:'firma'},{action:'open',category:'task',itemKey:'delicate',description:'Material deteriorat; necesită instrucțiuni',requestKey:'incident'});
 expect(()=>setChecklist(db,'u','new','delicate',true)).toThrow(/nerealizabilă/);
 expect(()=>setChecklist(db,'c','new','delicate',true)).toThrow(/Nu poți/);
 expect(markCompletedWithProof(db,'new','f','u')).toMatchObject({ok:false});
});
it('rolls back rules and job together if creation fails',()=>{
 publish();expect(()=>db.transaction(()=>{job('new');freezeExecutionRules(db,'new','standard');throw Error('rollback');}).immediate()).toThrow('rollback');
 expect(db.prepare('SELECT * FROM jobs').all()).toEqual([]);expect(db.prepare('SELECT * FROM job_execution_rules').all()).toEqual([]);
});
it('freezes service-specific photo counts and gates report, completion and capture',()=>{
 db.transaction(()=>saveExecutionTemplate(db,{scope:'standard',revision:0,reason:'Approved photo policy',items:[{key:'inspection',label:'Inspection'}],photoRules:{arrivalMin:2,completionMin:3}},'admin')).immediate();
 job('new');freeze('new');photo('a1','ARRIVAL');photo('c1','COMPLETION');setChecklist(db,'u','new','inspection',true);
 expect(()=>submitExecutionReport(db,'u','new','Ready')).toThrow(/fotografiile/);expect(markCompletedWithProof(db,'new','f','u')).toMatchObject({ok:false});
 photo('a2','ARRIVAL');photo('c2','COMPLETION');photo('c3','COMPLETION');submitExecutionReport(db,'u','new','All photos');expect(markCompletedWithProof(db,'new','f','u')).toEqual({ok:true});
 publish(1);job('repair');freeze('repair','new');expect(db.prepare("SELECT arrival_min,completion_min FROM job_photo_rules WHERE job_id='repair'").get()).toEqual({arrival_min:2,completion_min:3});
 expect(()=>db.exec("UPDATE job_photo_rules SET completion_min=1")).toThrow(/immutable/);
});
it('does not apply new photo requirements to legacy jobs and rejects invalid minima',()=>{
 job('legacy');for(const photoRules of [{arrivalMin:0,completionMin:1},{arrivalMin:1,completionMin:21},{arrivalMin:1.5,completionMin:2},null])expect(()=>db.transaction(()=>saveExecutionTemplate(db,{scope:'standard',revision:0,reason:'Test',items:[{key:'a',label:'A'}],photoRules},'admin')).immediate()).toThrow(/foto/);
 db.prepare("INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,status,validated_at) VALUES('legacy-proof','legacy','u','f','COMPLETION','proof.jpg','VALID',datetime('now'))").run();
 expect(markCompletedWithProof(db,'legacy','f','u')).toEqual({ok:true});
});
