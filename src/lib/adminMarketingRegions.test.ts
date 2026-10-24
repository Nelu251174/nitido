import { describe,expect,it } from 'vitest';
import Database from 'better-sqlite3';
import { MARKETING_REGIONS,MARKETING_COUNTY_ORDER,marketingRegion } from './adminMarketingRegions';
import { initializeMarketing,MARKETING_SCHEMA,saveMarketingContacts,listMarketingContacts,exportMarketingCsv } from './adminMarketing';
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
  const a=listMarketingContacts(db,new URLSearchParams({county:'CT'})),b=listMarketingContacts(db,new URLSearchParams({county:'B'}));expect(a.total).toBe(1);expect(b.total).toBe(1);expect(b.contacts[0].county).toBe('Constanța');expect(b.contacts[0].regions).toHaveLength(2);expect(exportMarketingCsv(db,new URLSearchParams({county:'CT'}))).toContain('county');db.close();
 });
});
