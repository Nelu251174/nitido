import { describe,expect,it } from 'vitest';
import Database from 'better-sqlite3';
import { MARKETING_REGIONS,MARKETING_COUNTY_ORDER,marketingRegion } from './adminMarketingRegions';
import { initializeMarketing,MARKETING_SCHEMA,saveMarketingContacts,listMarketingContacts,exportMarketingCsv,marketingCsvChunks } from './adminMarketing';
describe('Marketing county organization',()=>{
 it('has all 41 counties and an independent București group, with the requested queue order',()=>{expect(MARKETING_REGIONS).toHaveLength(42);expect(new Set(MARKETING_REGIONS.map(r=>r.code)).size).toBe(42);expect(MARKETING_COUNTY_ORDER.slice(0,2)).toEqual(['CT','B']);expect(marketingRegion('București')?.code).toBe('B');expect(marketingRegion('Ilfov')?.code).toBe('IF');expect(marketingRegion('RO-CT')?.name).toBe('Constanța');});
 it('adds geography to existing contacts without changing their data, consent, or protected tables',()=>{
  const db=new Database(':memory:');db.exec(MARKETING_SCHEMA+"CREATE TABLE jobs(id TEXT); INSERT INTO jobs VALUES('untouched');");
  db.prepare("INSERT INTO marketing_contacts(id,name,category,email,city,city_key,search_key,source,consent,status,created_by,created_at,updated_at) VALUES('legacy','Existing','business','office@fixture.example','Constanța','constanta','existing','Public','withdrawn','do_not_contact','owner','2026-01-01','2026-01-01')").run();
  initializeMarketing(db);initializeMarketing(db);const row=db.prepare('SELECT county,consent,status,version FROM marketing_contacts').get();expect(row).toEqual({county:'Constanța',consent:'withdrawn',status:'do_not_contact',version:1});expect(db.prepare('SELECT * FROM jobs').all()).toEqual([{id:'untouched'}]);db.close();
 });
 it('keeps a shared public email visible in every source county without overwriting the contact',()=>{
  const db=new Database(':memory:');const input={name:'Public firm',category:'business',email:'office@fixture.example',city:'Constanța',county:'Constanța',source:'https://source.example',consent:'not_recorded'};
  expect(saveMarketingContacts(db,[input],'owner').created).toBe(1);expect(saveMarketingContacts(db,[{...input,city:'București',county:'București'}],'owner').duplicates).toBe(1);
  const a=listMarketingContacts(db,new URLSearchParams({county:'CT'})),b=listMarketingContacts(db,new URLSearchParams({county:'B'}));expect(a.total).toBe(1);expect(b.total).toBe(1);expect(b.contacts[0].county).toBe('Constanța');expect(b.contacts[0].regions).toHaveLength(2);expect(listMarketingContacts(db,new URLSearchParams({county:'B',city:'București'})).total).toBe(1);expect(listMarketingContacts(db,new URLSearchParams({county:'B',city:'Constanța'})).total).toBe(0);expect(exportMarketingCsv(db,new URLSearchParams({county:'CT'}))).toContain('county');expect(exportMarketingCsv(db,new URLSearchParams({county:'B'}))).toContain('"București","București"');db.close();
 });
 it('streams every contact beyond the old 5000-row export limit with bounded chunks',()=>{
  const db=new Database(':memory:');initializeMarketing(db);const input={name:'Firm',category:'business',city:'Mangalia',county:'CT',source:'Public',consent:'not_recorded'};
  for(let i=0;i<5001;i+=200)saveMarketingContacts(db,Array.from({length:Math.min(200,5001-i)},(_,j)=>({...input,email:`f${i+j}@firm.ro`})),'owner');
  const chunks=[...marketingCsvChunks(db,new URLSearchParams({county:'CT'}))];expect(chunks).toHaveLength(12);expect(chunks.join('').split('\r\n')).toHaveLength(5002);db.close();
 });

});
