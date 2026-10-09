import type {Database} from 'better-sqlite3';
import type Stripe from 'stripe';
import {randomUUID} from 'node:crypto';
import {processStripeEvent} from './stripeEventProcessor';
import {reconcilePaymentCancellation} from './paymentCancellation';


type Candidate={kind:'event'|'cancellation';resource_id:string;attempts:number};
export type RecoveryResult={status:'completed'|'busy'|'cooldown';attempted:number;processed:number;deferred:number;failed:number};
const LEASE_MS=120000, BUDGET_MS=40000, MAX_ITEMS=10, MAX_ATTEMPTS=8;

export function sandboxRecoveryConfigured(env:NodeJS.ProcessEnv=process.env){
 if(env.NITIDO_FINANCIAL_RECOVERY_ENABLED!=='true'||! /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY??'')||!/^acct_[a-zA-Z0-9]{1,100}$/.test(env.NITIDO_STRIPE_PLATFORM_ACCOUNT_ID??'')||env.NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED!=='false')return false;
 try{const url=new URL(env.NEXT_PUBLIC_SITE_URL??'');return url.origin==='https://sandbox.nitido.ro'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash;}catch{return false;}
}

/** Bounded sandbox batch; no captures, refunds, transfers, new intents or payload ingestion. */
export async function runFinancialRecovery(db:Database,stripe:Stripe,options:{now?:()=>number;env?:NodeJS.ProcessEnv}={}):Promise<RecoveryResult>{
 const env=options.env??process.env,now=options.now??Date.now;
 if(!sandboxRecoveryConfigured(env))throw Error('SANDBOX_RECOVERY_NOT_CONFIGURED');
 const token=randomUUID(),started=now();
 const result:RecoveryResult={status:'completed',attempted:0,processed:0,deferred:0,failed:0};
 const claimed=db.transaction(()=>{
   db.prepare('INSERT OR IGNORE INTO financial_recovery_lock(id) VALUES(1)').run();
   const lock=db.prepare('SELECT token,lease_until_ms,next_run_ms FROM financial_recovery_lock WHERE id=1').get() as {token:string|null;lease_until_ms:number;next_run_ms:number};
   if(lock.token&&lock.lease_until_ms>started)return 'busy' as const;
   if(lock.next_run_ms>started)return 'cooldown' as const;
   if(lock.token)db.prepare("UPDATE financial_recovery_runs SET status='abandoned',completed_ms=?,last_error='LEASE_EXPIRED' WHERE id=? AND status='running'").run(started,lock.token);
   db.prepare('UPDATE financial_recovery_lock SET token=?,lease_until_ms=? WHERE id=1').run(token,started+LEASE_MS);
   db.prepare("INSERT INTO financial_recovery_runs(id,status,started_ms) VALUES(?,'running',?)").run(token,started);
   return 'claimed' as const;
 }).immediate();
 if(claimed!=='claimed')return {...result,status:claimed};
 const assertLease=()=>{
   if(!db.prepare('SELECT 1 FROM financial_recovery_lock WHERE id=1 AND token=? AND lease_until_ms>?').get(token,now()))throw Error('RECOVERY_LEASE_LOST');
 };
 try{
   const account=await stripe.accounts.retrieve(null);
   if(account.id!==env.NITIDO_STRIPE_PLATFORM_ACCOUNT_ID)throw Error('RECOVERY_ACCOUNT_MISMATCH');
   assertLease();
   const candidates=db.prepare(`SELECT q.kind,q.resource_id,COALESCE(i.attempts,0) AS attempts FROM (
     SELECT 'event' AS kind,event_id AS resource_id,received_at AS created_at FROM stripe_webhook_inbox WHERE status IN ('received','failed','needs_review')
     UNION ALL
     SELECT 'cancellation',c.job_id,c.created_at FROM payment_cancellation_requests c JOIN jobs j ON j.id=c.job_id WHERE c.status!='processed' AND j.status IN ('cancelled','no_show')
   ) q LEFT JOIN financial_recovery_items i ON i.kind=q.kind AND i.resource_id=q.resource_id
   WHERE COALESCE(i.parked,0)=0 AND COALESCE(i.next_attempt_ms,0)<=?
   ORDER BY COALESCE(i.next_attempt_ms,0),q.created_at,q.kind,q.resource_id LIMIT ?`).all(now(),MAX_ITEMS) as Candidate[];
   for(const item of candidates){
     if(now()-started>=BUDGET_MS)break;
     assertLease();
     // Persist the attempt before the external call. A crash cannot reset the retry budget.
     db.transaction(()=>{
       assertLease();
       db.prepare(`INSERT INTO financial_recovery_items(kind,resource_id,attempts,next_attempt_ms) VALUES(?,?,1,?)
         ON CONFLICT(kind,resource_id) DO UPDATE SET attempts=attempts+1,next_attempt_ms=excluded.next_attempt_ms,parked=CASE WHEN attempts+1>=8 THEN 1 ELSE parked END`).run(item.kind,item.resource_id,now()+LEASE_MS);
       db.prepare('UPDATE financial_recovery_runs SET attempted=attempted+1 WHERE id=?').run(token);
     })();
     result.attempted++;
     let resolved=false,errorCode:string|null=null;
     try{
       if(item.kind==='event'){
         const saved=db.prepare('SELECT event_type,account_id,resource_id,status,envelope_json FROM stripe_webhook_inbox WHERE event_id=?').get(item.resource_id) as {event_type:string;account_id:string;resource_id:string|null;status:string;envelope_json:string};
         if(['processed','ignored'].includes(saved.status))resolved=true;
         else{
           const envelope=JSON.parse(saved.envelope_json) as {livemode?:boolean};
           if(envelope.livemode!==false)throw Error('EVENT_SANDBOX_IDENTITY_REQUIRED');
           const event=await stripe.events.retrieve(item.resource_id,{},saved.account_id?{stripeAccount:saved.account_id}:{});
           const object=event.data.object as {id?:string};
           if(event.id!==item.resource_id||event.type!==saved.event_type||(event.account??'')!==saved.account_id||(object.id??null)!==saved.resource_id||event.livemode!==false)throw Error('EVENT_SANDBOX_IDENTITY_REQUIRED');
           assertLease();
           await processStripeEvent(db,stripe,event,{beforeCommit:assertLease});
           const current=db.prepare('SELECT status FROM stripe_webhook_inbox WHERE event_id=?').get(item.resource_id) as {status:string};
           resolved=['processed','ignored'].includes(current.status);
         }
       }else{
         // Never discover an unknown intent by amount, date or client-supplied metadata.
         const current=db.prepare("SELECT c.status,j.status AS job_status FROM payment_cancellation_requests c JOIN jobs j ON j.id=c.job_id WHERE c.job_id=?").get(item.resource_id) as {status:string;job_status:string};
         if(current.status==='processed')resolved=true;
         else if(['cancelled','no_show'].includes(current.job_status)){
           await reconcilePaymentCancellation(db,item.resource_id,stripe,{sandboxOnly:true,beforeMutation:assertLease});
           resolved=(db.prepare('SELECT status FROM payment_cancellation_requests WHERE job_id=?').get(item.resource_id) as {status:string}).status==='processed';
         }
       }
     }catch{errorCode='RECOVERY_ITEM_NOT_CONFIRMED';}
     db.transaction(()=>{
       assertLease();
       const attempt=(db.prepare('SELECT attempts FROM financial_recovery_items WHERE kind=? AND resource_id=?').get(item.kind,item.resource_id) as {attempts:number}).attempts;
       db.prepare('UPDATE financial_recovery_items SET next_attempt_ms=?,parked=?,last_error=? WHERE kind=? AND resource_id=?').run(
         resolved?0:now()+Math.min(6*3600000,60000*2**Math.min(attempt-1,9)),!resolved&&attempt>=MAX_ATTEMPTS?1:0,errorCode??(resolved?null:'RESOURCE_NOT_RESOLVED'),item.kind,item.resource_id);
       if(resolved)result.processed++;else if(errorCode)result.failed++;else result.deferred++;
       db.prepare('UPDATE financial_recovery_runs SET attempted=?,processed=?,deferred=?,failed=? WHERE id=?').run(result.attempted,result.processed,result.deferred,result.failed,token);
     })();
   }
   db.transaction(()=>{
     assertLease();
     db.prepare("UPDATE financial_recovery_runs SET status='completed',completed_ms=? WHERE id=?").run(now(),token);
     db.prepare('UPDATE financial_recovery_lock SET token=NULL,lease_until_ms=0,next_run_ms=? WHERE id=1 AND token=?').run(now()+60000,token);
   })();
   return result;
 }catch(error){
   db.transaction(()=>{
     db.prepare("UPDATE financial_recovery_runs SET status='failed',completed_ms=?,last_error='RECOVERY_RUN_NOT_CONFIRMED' WHERE id=? AND status='running'").run(now(),token);
     db.prepare('UPDATE financial_recovery_lock SET token=NULL,lease_until_ms=0,next_run_ms=? WHERE id=1 AND token=?').run(now()+60000,token);
   })();
   throw error;
 }
}
