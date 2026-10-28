import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
import {saveMarketingContacts} from './adminMarketing';
import {marketingSettings,saveMarketingSettings,saveMarketingCampaign,setMarketingCampaignState} from './adminMarketingWorkspace';
import {DeliveryDeferred,DeliveryUnconfirmed,initializeMarketingDelivery,marketingDeliveryReport,marketingProviderHold,processMarketingDelivery,queueMarketingCampaign,resumeMarketingProvider,sendMarketingResend} from './adminMarketingDelivery';
let db:Database.Database;
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-28T09:00:00Z'));
 vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','true');vi.stubEnv('RESEND_API_KEY','synthetic');vi.stubEnv('NITIDO_MARKETING_WEBHOOK_SECRET','synthetic');
 db=new Database(':memory:');db.exec('CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');initializeMarketingDelivery(db);
 saveMarketingContacts(db,Array.from({length:3},(_,i)=>({name:'Synthetic '+i,category:'business',email:`person${i}@example.test`,city:'Constanța',source:'Synthetic fixture',consent:'granted',consentEvidence:'Synthetic opt-in'})),'fixture');
 db.exec("UPDATE marketing_contacts SET status='reviewed';INSERT OR REPLACE INTO marketing_email_checks(email,status,source_status,domain_status) SELECT email,'verified','verified','mx' FROM marketing_contacts");
 saveMarketingSettings(db,{...marketingSettings(db),senderName:'Synthetic',senderEmail:'from@example.test',replyTo:'reply@example.test',postalAddress:'Synthetic address',dailyLimit:100,unitCostRon:0,monthlyBudgetRon:null},'fixture');
 const draft=saveMarketingCampaign(db,{name:'Synthetic',subject:'Test',body:'Synthetic body',category:'business',city:'Constanța',ctaLabel:'',ctaUrl:'',budgetRon:null},'fixture');
 const ready=setMarketingCampaignState(db,{...draft,state:'ready'},'fixture');queueMarketingCampaign(db,{id:ready.id,version:ready.version,mode:'live',requestId:'synthetic-request-001'},'fixture');
});
afterEach(()=>{db.close();vi.useRealTimers();vi.unstubAllEnvs();vi.restoreAllMocks();});
async function tick(transport:Parameters<typeof processMarketingDelivery>[1]){const result=processMarketingDelivery(db,transport);await vi.advanceTimersByTimeAsync(4000);return result;}
function counts(){return db.prepare('SELECT status,COUNT(*) n FROM marketing_outbox GROUP BY status ORDER BY status').all();}
describe('Marketing provider failure containment',()=>{
 it.each(['pause','disable'])('preserves every unstarted message when %s occurs during a provider call',async action=>{
  const transport=vi.fn().mockImplementation(async()=>{
   if(action==='pause')db.prepare("UPDATE marketing_campaigns SET state='paused'").run();else vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','false');
   return {id:'provider-confirmed'};
  });
  await tick(transport);expect(transport).toHaveBeenCalledOnce();expect(counts()).toEqual([{status:'accepted',n:1},{status:'pending',n:2}]);
 });
 it('holds a 429 in pending, stops the batch, and retries with the exact saved payload and idempotency key',async()=>{
  const transport=vi.fn().mockRejectedValueOnce(new DeliveryDeferred('rate_limit_exceeded',new Date(Date.now()+60000).toISOString(),429)).mockImplementation(async()=>({id:'provider-'+transport.mock.calls.length}));
  expect((await tick(transport)).processed).toBe(1);expect(counts()).toEqual([{status:'pending',n:3}]);expect(marketingProviderHold(db)?.code).toBe('rate_limit_exceeded');
  await tick(transport);expect(transport).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(60000);await tick(transport);
  expect(counts()).toEqual([{status:'accepted',n:3}]);expect(transport.mock.calls[1]).toEqual(transport.mock.calls[0]);expect(db.prepare('SELECT COUNT(*) n FROM marketing_unsubscribe').get()).toEqual({n:3});
 });
 it.each(['daily_quota_exceeded','monthly_quota_exceeded','rate_limit_exceeded'])('retains the documented %s reason without treating an explicit quota rejection as ambiguous',async name=>{
  const network=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({name,message:'Do not persist raw provider text'}),{status:429,headers:{'retry-after':'120'}}));
  await tick(sendMarketingResend);expect(network).toHaveBeenCalledOnce();expect(counts()).toEqual([{status:'pending',n:3}]);
  const hold=marketingProviderHold(db)!;expect(hold.code).toBe(name);expect(JSON.stringify(marketingDeliveryReport(db))).not.toContain('Do not persist');
  if(name==='monthly_quota_exceeded')expect(hold.retryAt).toBeNull();
  if(name==='daily_quota_exceeded')expect(hold.retryAt).toBe('2026-10-29T00:00:05.000Z');
  if(name==='rate_limit_exceeded')expect(hold.retryAt).toBe('2026-10-28T09:02:00.000Z');
 });
 it('stops a cascade after uncertain outcomes without ever automatically retrying those messages',async()=>{
  const transport=vi.fn().mockRejectedValue(new DeliveryUnconfirmed('NETWORK_TIMEOUT'));
  await tick(transport);expect(counts()).toEqual([{status:'pending',n:2},{status:'unknown',n:1}]);await tick(transport);expect(transport).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(60000);await tick(transport);await vi.advanceTimersByTimeAsync(120000);await tick(transport);
  expect(transport).toHaveBeenCalledTimes(3);expect(marketingProviderHold(db)?.retryAt).toBeNull();await vi.advanceTimersByTimeAsync(86400000);await tick(transport);expect(transport).toHaveBeenCalledTimes(3);
 });
 it('keeps historical unknowns untouched and labels their missing evidence honestly',async()=>{
  const first=db.prepare('SELECT id FROM marketing_outbox ORDER BY id LIMIT 1').get() as {id:string};db.prepare("UPDATE marketing_outbox SET status='unknown' WHERE id=?").run(first.id);
  const transport=vi.fn().mockResolvedValue({id:'provider-new'});transport.mockImplementation(async()=>({id:'provider-'+transport.mock.calls.length}));await tick(transport);
  expect(transport).toHaveBeenCalledTimes(2);expect((marketingDeliveryReport(db).runs[0].failures as {code:string;count:number}[])).toEqual([{code:'legacy_unconfirmed',count:1}]);
  resumeMarketingProvider(db,'fixture');await tick(transport);expect(transport).toHaveBeenCalledTimes(2);
 });
 it('holds the queue after an authentication refusal instead of consuming every recipient',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({name:'validation_error'}),{status:401}));await tick(sendMarketingResend);
  expect(counts()).toEqual([{status:'pending',n:3}]);expect(marketingProviderHold(db)).toMatchObject({code:'provider_configuration',retryAt:null});
 });
});
