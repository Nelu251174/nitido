import {retentionEvent,retentionMetrics} from './retentionMetrics';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {favoriteFirms,saveFavorite,attachPreferredFirm,repeatBookingValues,attachRepeatOrigin} from './clientRetention';
let db:Database.Database;
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-22T06:00:00Z'));
  db=new Database(':memory:');db.pragma('foreign_keys=ON');initializeDatabase(db);
  db.exec(`INSERT INTO users(id,role,name,email) VALUES('c','client','Client','c@example.test'),('other','client','Other','o@example.test'),('fu','firma','Firm','f@example.test');
    INSERT INTO firms(id,user_id,verified,coverage_city) VALUES('f','fu',1,'Constanța');
    INSERT INTO service_catalog_firms(category_key,firm_id,enabled) VALUES('general','f',1);
    INSERT INTO jobs(id,client_id,city,street,details,sqm,space_type,bathroom_count,windows_sqm,status,accepted_firm_id,mode,when_type,scheduled_at,duration_minutes,buffer_minutes,price_gross)
    VALUES('old','c','Constanța','Private','Access code 1234, parent email',80,'apartament',2,5,'completed','f','standard','scheduled','2026-10-20T07:00:00Z',180,30,200),
    ('new','c','Constanța','New address',NULL,80,'apartament',2,5,'waiting',NULL,'standard','scheduled','2026-10-23T07:00:00Z',180,30,600);`);
});
afterEach(()=>{db.close();vi.useRealTimers()});
it('saves once only from own completed work, independently of rating; deletion is isolated and silent',()=>{
  expect(()=>saveFavorite(db,'other','f',true)).toThrow();saveFavorite(db,'c','f',true);saveFavorite(db,'c','f',true);
  expect(favoriteFirms(db,'c')).toMatchObject([{id:'f',saved:1}]);expect(favoriteFirms(db,'other')).toEqual([]);
  saveFavorite(db,'other','f',false);expect(favoriteFirms(db,'c')[0].saved).toBe(1);
  saveFavorite(db,'c','f',false);expect(favoriteFirms(db,'c')[0].saved).toBe(0);
  expect(db.prepare('SELECT COUNT(*) n FROM workspace_notices').get()).toEqual({n:0});
});
it('refuses unverified and suspended firms but allows removing them',()=>{
  saveFavorite(db,'c','f',true);db.exec("UPDATE firms SET verified=0");expect(()=>saveFavorite(db,'c','f',true)).toThrow();saveFavorite(db,'c','f',false);
  db.exec("UPDATE firms SET verified=1,suspended_until='2026-10-24T00:00:00Z'");expect(()=>saveFavorite(db,'c','f',true)).toThrow();
});
it('invites the preferred firm only on a new Standard request and does not allocate or pay',()=>{
  saveFavorite(db,'c','f',true);db.transaction(()=>attachPreferredFirm(db,'new','c','f')).immediate();
  expect(db.prepare("SELECT accepted_firm_id,status FROM jobs WHERE id='new'").get()).toEqual({accepted_firm_id:null,status:'waiting'});
  expect(db.prepare('SELECT COUNT(*) n FROM payments').get()).toEqual({n:0});expect(db.prepare('SELECT user_id FROM workspace_notices').get()).toEqual({user_id:'fu'});
  expect(()=>attachPreferredFirm(db,'old','c','f')).toThrow();expect(()=>attachPreferredFirm(db,'new','other','f')).toThrow();
});
it('rechecks coverage, service and calendar before inviting a preferred firm',()=>{
  saveFavorite(db,'c','f',true);db.exec("UPDATE firms SET coverage_city='București'");expect(()=>attachPreferredFirm(db,'new','c','f')).toThrow(/localitate/);
  db.exec("UPDATE firms SET coverage_city='Constanța';UPDATE service_catalog_firms SET enabled=0");expect(()=>attachPreferredFirm(db,'new','c','f')).toThrow(/serviciu/);
  db.exec("UPDATE service_catalog_firms SET enabled=1;UPDATE jobs SET status='accepted',scheduled_at='2026-10-23T08:00:00Z' WHERE id='old'");
  expect(()=>attachPreferredFirm(db,'new','c','f')).toThrow();
});
it('repetition is a read-only whitelisted draft with no date, access notes, photos or price',()=>{
  const before=db.prepare("SELECT * FROM jobs WHERE id='old'").get();const d=repeatBookingValues(db,'c','old');
  expect(d).toMatchObject({repeatJobId:'old',city:'Constanța',sqm:80,bathroomCount:2,windowsSqm:5,details:''});
  for(const key of ['scheduled_at','price_gross','pricing_snapshot','photos','beneficiary','cardId','entrance','accepted_firm_id'])expect(d).not.toHaveProperty(key);
  expect(()=>repeatBookingValues(db,'other','old')).toThrow();expect(()=>repeatBookingValues(db,'c','new')).toThrow();
  expect(db.prepare("SELECT * FROM jobs WHERE id='old'").get()).toEqual(before);expect(db.prepare('SELECT COUNT(*) n FROM jobs').get()).toEqual({n:2});
  attachRepeatOrigin(db,'new','c','old');expect(db.prepare('SELECT original_job_id FROM job_repeat_origins').get()).toEqual({original_job_id:'old'});
});
it('uses the current owned home and blocks archived or transferred homes',()=>{
  db.exec(`INSERT INTO workspace_properties(id,owner_id,name,city,street,sqm,space_type,bathroom_count,created_at) VALUES('p','c','Home','Constanța','Updated',90,'apartament',3,CURRENT_TIMESTAMP);
    INSERT INTO workspace_property_jobs VALUES('old','p');`);
  expect(repeatBookingValues(db,'c','old')).toMatchObject({propertyId:'p',street:'Updated',sqm:90,bathroomCount:3,details:''});
  db.exec("UPDATE workspace_properties SET archived=1");expect(()=>repeatBookingValues(db,'c','old')).toThrow(/Proprietatea/);
  db.exec("UPDATE workspace_properties SET archived=0,owner_id='other'");expect(()=>repeatBookingValues(db,'c','old')).toThrow();
});
it('additive initialization is idempotent and preserves favorites and old jobs',()=>{
  saveFavorite(db,'c','f',true);const old=db.prepare("SELECT * FROM jobs WHERE id='old'").get();initializeDatabase(db);initializeDatabase(db);
  expect(favoriteFirms(db,'c')[0].saved).toBe(1);expect(db.prepare("SELECT * FROM jobs WHERE id='old'").get()).toEqual(old);
});

it('operational events are client-bound, deduplicated by day and do not count clicks as paid bookings',()=>{retentionEvent(db,'c','repeat_open','old');retentionEvent(db,'c','repeat_open','old');expect(()=>retentionEvent(db,'other','repeat_open','old')).toThrow();const metrics=retentionMetrics(db);expect(metrics.opens).toEqual([{kind:'repeat_open',n:1}]);expect(metrics.repeatBookings).toMatchObject({created:0,allocated:0,completed:0,captured:0});});
