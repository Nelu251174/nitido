import {createHash} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import {ownerNotificationConfig,sendOwnerEmail,OWNER_EMAIL_RETRY_WINDOW_MS,type OwnerSender} from '../adminOwnerEvents';
const ACTOR='pro-lead-email-v1';
type State={status:'pending'|'sending'|'sent'|'failed'|'uncertain';attempts:number;next:number;first?:number;lease?:number;recipientHash?:string};
export function queueLeadNotification(db:Database,id:string){
 db.prepare('INSERT OR IGNORE INTO pro_idempotency VALUES(?,?,?,?)').run(ACTOR,id,'notification-v1',JSON.stringify({status:'pending',attempts:0,next:0}));
}
/** Existing durable Pro storage and cron; never scans or notifies historical leads. */
export async function processLeadNotifications(db:Database,options:{sender?:OwnerSender;now?:number}={}){
 const config=ownerNotificationConfig(),now=options.now??Date.now();
 if(!config.enabled||!config.recipient||!config.emailConfigured)return {status:'disabled',accepted:0};
 const rows=db.prepare("SELECT key,result_json FROM pro_idempotency WHERE actor=? AND json_extract(result_json,'$.status') IN ('pending','failed','sending') AND json_extract(result_json,'$.attempts')<5 AND json_extract(result_json,'$.next')<=? ORDER BY rowid LIMIT 10").all(ACTOR,now) as {key:string;result_json:string}[];
 const recipientHash=createHash('sha256').update(config.recipient).digest('hex');
 let accepted=0;
 for(const row of rows){
  const claim=db.transaction(()=>{
   const raw=db.prepare('SELECT result_json FROM pro_idempotency WHERE actor=? AND key=?').get(ACTOR,row.key) as {result_json:string};
   const state=JSON.parse(raw.result_json) as State;
   if(state.status==='sent'||state.status==='uncertain'||state.next>now||state.attempts>=5||(state.status==='sending'&&(state.lease??0)>now))return null;
   if((state.recipientHash&&state.recipientHash!==recipientHash)||(state.first!==undefined&&now-state.first>=OWNER_EMAIL_RETRY_WINDOW_MS)){state.status='uncertain';db.prepare('UPDATE pro_idempotency SET result_json=? WHERE actor=? AND key=?').run(JSON.stringify(state),ACTOR,row.key);return null;}
   const next={...state,recipientHash,status:'sending' as const,first:state.first??now,lease:now+120000,attempts:state.attempts+1};
   db.prepare('UPDATE pro_idempotency SET result_json=? WHERE actor=? AND key=?').run(JSON.stringify(next),ACTOR,row.key);return next;
  }).immediate();
  if(!claim)continue;
  const site=process.env.NEXT_PUBLIC_SITE_URL==='https://sandbox.nitido.ro'?'https://sandbox.nitido.ro':'https://nitido.ro';
  let sent;try{sent=await (options.sender??sendOwnerEmail)({to:config.recipient,subject:'NITIDO Pro — solicitare nouă de evaluare',html:`<p>O solicitare Pro a fost înregistrată.</p><p>Referință: ${row.key}</p><p><a href="${site}/pro/operator">Deschide solicitările Pro</a></p>`,idempotencyKey:'nitido-pro-lead-'+row.key});}catch{sent={error:'EMAIL_RESPONSE_UNKNOWN',retryable:true};}
  const success='id' in sent;
  const next:State={...claim,status:success?'sent':'failed',attempts:!success&&'retryable' in sent&&!sent.retryable?5:claim.attempts,next:now+60000*2**claim.attempts};
  db.prepare('UPDATE pro_idempotency SET result_json=? WHERE actor=? AND key=?').run(JSON.stringify(next),ACTOR,row.key);
  if(success)accepted++;
  break; // Bounded to one provider call; shares the existing minute worker.
 }
 return {status:'processed',accepted};
}
