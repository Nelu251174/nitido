import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {initializeMarketingSignup,submitMarketingSignup,prepareMarketingSignupConfirmation,confirmMarketingSignup,marketingSignupView,withdrawMarketingSignup,processMarketingAudienceChecks} from './adminMarketingSignup';
import {MARKETING_SIGNUP_CONSENT_VERSION} from './adminMarketingSignupShared';
import {saveMarketingContacts,bulkMarketingContactStatus} from './adminMarketing';
import {verifyMarketingEmail} from './adminMarketingEmailVerification';
import {getMarketingWorkspace,previewMarketingCampaign,saveMarketingCampaign} from './adminMarketingWorkspace';
let db:Database.Database;
const body={name:'Synthetic lead',email:'lead@fixture.ro',category:'individual',county:'CT',city:'Mangalia',consent:true,consentVersion:MARKETING_SIGNUP_CONSENT_VERSION};
const row=()=>db.prepare('SELECT * FROM marketing_signups').get() as {id:string;version:number;state:string;confirmation_hash:string|null};
beforeEach(()=>{db=new Database(':memory:');db.exec('CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');initializeMarketingSignup(db);vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','false');});
afterEach(()=>{db.close();vi.unstubAllEnvs();vi.useRealTimers();});
describe('voluntary Marketing audience intake',()=>{
 it('records only explicit consent, never exposes tokens or account existence and creates no eligible contact while delivery is off',()=>{
  expect(()=>submitMarketingSignup(db,{...body,consent:false})).toThrow('acordul');expect(()=>submitMarketingSignup(db,{...body,county:'unknown'})).toThrow();
  const result=submitMarketingSignup(db,body);expect(result).toEqual({received:true});expect(submitMarketingSignup(db,body)).toEqual(result);
  expect(db.prepare('SELECT COUNT(*) n FROM marketing_signups').get()).toEqual({n:1});expect(row()).toMatchObject({state:'pending',confirmation_hash:null});expect(()=>prepareMarketingSignupConfirmation(db,row().id)).toThrow('oprită');
  expect(getMarketingWorkspace(db).totals).toMatchObject({contacts:0,eligible:0,realEmailsSent:0});expect(marketingSignupView(db,new URLSearchParams()).items[0]).not.toHaveProperty('confirmation_hash');
 });
 it('requires a valid token before creating a consented contact and preserves the need for manual review',async()=>{
  submitMarketingSignup(db,body);expect(()=>confirmMarketingSignup(db,'invalid')).toThrow();vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','true');const token=prepareMarketingSignupConfirmation(db,row().id);expect(row().confirmation_hash).not.toBe(token);
  vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','false');const result=confirmMarketingSignup(db,token);expect(result.emailToVerify).toBe(body.email);await verifyMarketingEmail(db,body.email,async()=>({state:'mx',reason:'PUBLIC_MX_PRESENT'}));
  expect(db.prepare('SELECT category,consent,status FROM marketing_contacts').get()).toEqual({category:'individual',consent:'granted',status:'new'});
  const campaign=saveMarketingCampaign(db,{name:'Test',category:'individual',county:'CT',subject:'Test',body:'Test'},'owner');expect(previewMarketingCampaign(db,campaign.id)).toMatchObject({selected:1,eligible:0,reasons:{notReviewed:1}});
  expect(confirmMarketingSignup(db,token)).toEqual({confirmed:true,emailToVerify:null});expect(db.prepare('SELECT COUNT(*) n FROM marketing_contacts').get()).toEqual({n:1});
 });
 it('never reactivates a prior opt-out even after a valid new confirmation',()=>{
  saveMarketingContacts(db,[{name:'Protected',category:'business',county:'CT',city:'Mangalia',email:body.email,source:'Synthetic',consent:'withdrawn'}],'owner');submitMarketingSignup(db,body);vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','true');const token=prepareMarketingSignupConfirmation(db,row().id);
  expect(confirmMarketingSignup(db,token).emailToVerify).toBeNull();expect(db.prepare('SELECT consent,status FROM marketing_contacts').get()).toEqual({consent:'withdrawn',status:'do_not_contact'});expect(marketingSignupView(db,new URLSearchParams()).items[0].review_required).toBe('protected_contact');
 });
 it('rejects expired or withdrawn confirmations, protects optimistic versions and removes only expired pending requests',()=>{
  vi.useFakeTimers();submitMarketingSignup(db,body);vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','true');const token=prepareMarketingSignupConfirmation(db,row().id);vi.setSystemTime(Date.now()+8*86400000);expect(()=>confirmMarketingSignup(db,token)).toThrow('expirat');
  expect(()=>withdrawMarketingSignup(db,row().id,999,'owner')).toThrow('modificată');withdrawMarketingSignup(db,row().id,row().version,'owner');expect(()=>confirmMarketingSignup(db,token)).toThrow();
  submitMarketingSignup(db,{...body,email:'other@fixture.ro'});vi.setSystemTime(Date.now()+31*86400000);submitMarketingSignup(db,{...body,email:'third@fixture.ro'});expect(db.prepare('SELECT state,COUNT(*) n FROM marketing_signups GROUP BY state ORDER BY state').all()).toEqual([{state:'pending',n:1},{state:'withdrawn',n:1}]);
 });
 it('handles honeypots without storage and withdraws confirmed contacts from all Marketing eligibility',()=>{
  expect(submitMarketingSignup(db,{website:'bot'})).toEqual({received:true});expect(db.prepare('SELECT COUNT(*) n FROM marketing_signups').get()).toEqual({n:0});
  submitMarketingSignup(db,body);vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','true');confirmMarketingSignup(db,prepareMarketingSignupConfirmation(db,row().id));withdrawMarketingSignup(db,row().id,row().version,'owner');expect(db.prepare('SELECT status,consent FROM marketing_contacts').get()).toEqual({status:'do_not_contact',consent:'withdrawn'});
 });
});

describe('manual consented imports receive technical checks',()=>{it('checks reviewed opt-ins without granting consent to collected public contacts',async()=>{
 saveMarketingContacts(db,[{name:'Opt-in',category:'business',city:'Mangalia',county:'CT',email:'opt@fixture.ro',source:'Owned form',consent:'granted',consentEvidence:'Actual fixture consent'},{name:'Public',category:'business',city:'Mangalia',county:'CT',email:'public@fixture.ro',source:'Public fixture',consent:'not_recorded'}],'owner');
 const ids=db.prepare('SELECT id,version FROM marketing_contacts').all() as {id:string;version:number}[];bulkMarketingContactStatus(db,ids,'reviewed');const reader=vi.fn(async()=>({state:'mx' as const,reason:'PUBLIC_MX_PRESENT'}));await processMarketingAudienceChecks(db,reader);
 expect(db.prepare('SELECT email,status FROM marketing_email_checks').all()).toEqual([{email:'opt@fixture.ro',status:'verified'}]);expect(db.prepare("SELECT consent FROM marketing_contacts WHERE email='public@fixture.ro'").get()).toEqual({consent:'not_recorded'});expect(reader).toHaveBeenCalledOnce();
});});
