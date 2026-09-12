import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {SCHEMA_SQL} from './db';
import {WORKSPACE_SCHEMA} from './workspace';
import {initializeCatalog} from './serviceCatalog';
import {CATALOG_CAPACITY_SCHEMA,catalogCapacity,setCatalogFirm} from './catalogCapacity';
let db:Database.Database;
const now=Date.parse('2026-09-01T00:00:00Z');
const interval={start:'2026-09-12T09:00:00Z',end:'2026-09-12T11:00:00Z'};
beforeEach(()=>{db=new Database(':memory:');db.pragma('foreign_keys=ON');db.exec(SCHEMA_SQL);db.exec(WORKSPACE_SCHEMA);initializeCatalog(db);db.exec(CATALOG_CAPACITY_SCHEMA);db.exec("INSERT INTO users(id,role,name) VALUES('f','firma','Firma'),('c','client','Client');INSERT INTO firms(id,user_id,coverage_city,coverage_cities_extra,verified) VALUES('firm','f','Constanța','Năvodari',1);INSERT INTO workspace_teams(id,firm_id,name) VALUES('t','firm','Echipa')")});
afterEach(()=>db.close());
const result=(i:typeof interval|undefined=interval)=>catalogCapacity(db,'general','navodari',i,now)[0];
function job(assigned=true){db.exec("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,buffer_minutes,status,accepted_firm_id) VALUES('j','c','Test','Năvodari',80,'apartament','scheduled','2026-09-12T07:00:00Z',550,120,30,'accepted','firm')");if(assigned)db.exec("INSERT INTO workspace_assignments(job_id,team_id,assigned_by,created_at) VALUES('j','t','f','2026-09-01')")}
describe('catalog category capacity',()=>{
 it('requires an explicit category association and normalized city coverage',()=>{expect(result().eligible).toBe(false);expect(setCatalogFirm(db,'general','firm',true)).toBe(true);expect(setCatalogFirm(db,'general','firm',true)).toBe(false);expect(result().eligible).toBe(true);expect(catalogCapacity(db,'general','București',undefined,now)[0].eligible).toBe(false);setCatalogFirm(db,'general','firm',false);expect(result().eligible).toBe(false)});
 it('reevaluates verification, suspension and active teams on every request',()=>{setCatalogFirm(db,'general','firm',true);db.exec('UPDATE firms SET verified=0');expect(result().eligible).toBe(false);db.exec("UPDATE firms SET verified=1,suspended_until='2026-10-01T00:00:00Z'");expect(result().eligible).toBe(false);db.exec("UPDATE firms SET suspended_until=NULL;UPDATE workspace_teams SET active=0");expect(result().eligible).toBe(false)});
 it('includes the travel buffer and permits adjacent intervals',()=>{setCatalogFirm(db,'general','firm',true);job();expect(result().availableTeams).toBe(0);expect(result({start:'2026-09-12T09:30:00Z',end:'2026-09-12T10:30:00Z'}).eligible).toBe(true)});
 it('rejects availability when an overlapping job has no assigned team',()=>{setCatalogFirm(db,'general','firm',true);job(false);expect(result().eligible).toBe(false);expect(result().reasons.join(' ')).toContain('fără echipă')});
 it('honors unavailable periods and excludes canceled blocks',()=>{setCatalogFirm(db,'general','firm',true);db.exec("INSERT INTO workspace_team_blocks(id,team_id,starts_at,ends_at,reason,created_by,created_at) VALUES('b','t','2026-09-12T08:00:00Z','2026-09-12T10:00:00Z','Indisponibil','f','2026-09-01')");expect(result().eligible).toBe(false);db.exec('UPDATE workspace_team_blocks SET cancelled=1');expect(result().eligible).toBe(true)});
 it('rejects malformed and reversed dates and does not claim availability without an interval',()=>{expect(()=>result({start:'bad',end:'bad'})).toThrow();expect(()=>result({start:interval.end,end:interval.start})).toThrow();expect(catalogCapacity(db,'general','Năvodari',undefined,now)[0].availableTeams).toBeNull()});
});
