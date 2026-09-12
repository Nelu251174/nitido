import {describe,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {initializeCatalog,catalogDrafts,saveCatalogDraft,validateCatalog} from './serviceCatalog';
const def=()=>({includes:'Aspirare',excludes:'Geamuri',equipment:'Aspirator',cities:'București',minSqm:10,maxSqm:1000,durationMinutes:null,extras:[{name:'Cuptor',unit:'aparat',rateBani:5000}]});
describe('versioned catalog drafts',()=>{
 it('initializes six categories without activating commercial tariffs and preserves edits on restart',()=>{const db=new Database(':memory:');try{initializeCatalog(db);expect(catalogDrafts(db)).toHaveLength(6);saveCatalogDraft(db,'general',0,def());initializeCatalog(db);expect(catalogDrafts(db).find(x=>x.key==='general')?.version).toBe(1)}finally{db.close()}});
 it('retains previous versions and rejects a stale editor without partial history writes',()=>{const db=new Database(':memory:');try{initializeCatalog(db);saveCatalogDraft(db,'general',0,def());saveCatalogDraft(db,'general',1,{...def(),includes:'Aspirare și ștergere praf'});expect(()=>saveCatalogDraft(db,'general',1,def())).toThrow(/între timp/);const rows=db.prepare('SELECT version,definition FROM service_catalog_history ORDER BY version').all() as {version:number;definition:string}[];expect(rows).toHaveLength(2);expect(JSON.parse(rows[0].definition).includes).toBe('Aspirare')}finally{db.close()}});
 it('rejects inverted limits, fractional tariffs and duplicate extras',()=>{for(const change of [{maxSqm:1},{extras:[{name:'Cuptor',unit:'aparat',rateBani:1.5}]},{extras:[def().extras[0],{...def().extras[0],name:' CUPTOR '}]}])expect(()=>validateCatalog({...def(),...change})).toThrow()});
 it('distinguishes an unconfigured tariff from a zero tariff',()=>{expect(validateCatalog({...def(),extras:[{...def().extras[0],rateBani:null}]}).extras[0].rateBani).toBeNull();expect(validateCatalog({...def(),extras:[{...def().extras[0],rateBani:0}]}).extras[0].rateBani).toBe(0)});
});
