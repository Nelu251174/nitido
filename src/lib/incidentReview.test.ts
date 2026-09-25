import {beforeEach,afterEach,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {changeVisitCare,readVisitCare} from './visitCare';
import {reviewIncident} from './incidentReview';
let db:Database.Database;
const owner={id:'client',role:'client'},firm={id:'provider',role:'firma'};
beforeEach(()=>{db=new Database(':memory:');db.pragma('foreign_keys=ON');initializeDatabase(db);db.exec(`INSERT INTO users(id,role,name) VALUES('client','client','C'),('provider','firma','P'),('other','client','O');INSERT INTO firms(id,user_id,coverage_city) VALUES('f','provider','București');INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id) VALUES('j','client','Test','București',80,'apartament','scheduled',500,120,'completed','f');`);changeVisitCare(db,'j',owner,{action:'open',category:'quality',description:'Pardoseala nu este curățată.',requestKey:'r'});});
afterEach(()=>db.close());
function review(){const c=readVisitCare(db,'j',owner).cases[0] as {id:string;updated_at:string};return db.transaction(()=>reviewIncident(db,{caseId:c.id,revision:c.updated_at,outcome:'confirmed',note:'Au fost analizate explicațiile ambelor părți.'},'verified-admin-session')).immediate();}
it('isolates reads and shares review conclusions only with existing authorized parties',()=>{review();for(const actor of [owner,firm])expect(readVisitCare(db,'j',actor).cases[0].reviews[0].outcome).toBe('confirmed');expect(()=>readVisitCare(db,'j',{id:'other',role:'client'})).toThrow(/interzis/);});
it('leaves execution, prices, provider score and receipts unchanged after review',()=>{const before=db.prepare('SELECT * FROM jobs').all(),providers=db.prepare('SELECT * FROM firms').all();review();expect(db.prepare('SELECT * FROM jobs').all()).toEqual(before);expect(db.prepare('SELECT * FROM firms').all()).toEqual(providers);expect(readVisitCare(db,'j',owner).receipt).toBeNull();expect(db.prepare('SELECT status FROM visit_cases').get()).toEqual({status:'open'});});
it('does not allow client or provider to review through the care mutation',()=>{const c=db.prepare('SELECT id,updated_at FROM visit_cases').get() as {id:string;updated_at:string};for(const actor of [owner,firm])expect(()=>changeVisitCare(db,'j',actor,{action:'review',caseId:c.id,revision:c.updated_at,note:'Confirmat',outcome:'confirmed'})).toThrow(/nepermisă/);});
it('rejects a stale remedy action after a review and preserves the review',()=>{const c=db.prepare('SELECT id,updated_at FROM visit_cases').get() as {id:string;updated_at:string};review();expect(()=>changeVisitCare(db,'j',owner,{action:'resolve',caseId:c.id,revision:c.updated_at,note:'Rezolvat'})).toThrow(/schimbat/);expect(readVisitCare(db,'j',owner).cases[0].reviews).toHaveLength(1);});
it('preserves reviews on repeated schema initialization',()=>{review();initializeDatabase(db);expect(readVisitCare(db,'j',owner).cases[0].reviews).toHaveLength(1);});
