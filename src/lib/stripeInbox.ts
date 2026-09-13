import type {Database} from 'better-sqlite3';
import type Stripe from 'stripe';

export const STRIPE_INBOX_SCHEMA=`
CREATE TABLE IF NOT EXISTS stripe_webhook_inbox (
 event_id TEXT PRIMARY KEY,
 event_type TEXT NOT NULL,
 account_id TEXT NOT NULL,
 resource_id TEXT,
 envelope_json TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('received','processed','needs_review','failed','ignored')),
 attempts INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,
 received_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stripe_inbox_status ON stripe_webhook_inbox(status,received_at);
`;
/** Store only fields needed for reconciliation; never card/customer details or client_secret. */
export function receiveStripeEvent(db:Database,event:Stripe.Event){
 const object=event.data.object as unknown as Record<string,unknown>;
 const fields:Record<string,unknown>={};
 for(const name of ['id','payment_intent','balance_transaction','charge']){
   const value=object[name];
   if(typeof value==='string')fields[name]=value;
   else if(value&&typeof value==='object'&&'id' in value&&typeof value.id==='string')fields[name]=value.id;
 }
 if(typeof object.reversed==='boolean')fields.reversed=object.reversed;
 const envelope=JSON.stringify({id:event.id,type:event.type,account:event.account??null,created:event.created,livemode:event.livemode,data:{object:fields}});
 db.prepare(`INSERT OR IGNORE INTO stripe_webhook_inbox(event_id,event_type,account_id,resource_id,envelope_json,status) VALUES(?,?,?,?,?,'received')`).run(event.id,event.type,event.account??'',typeof fields.id==='string'?fields.id:null,envelope);
 const row=db.prepare('SELECT event_type,account_id,resource_id FROM stripe_webhook_inbox WHERE event_id=?').get(event.id) as {event_type:string;account_id:string;resource_id:string|null};
 if(row.event_type!==event.type||row.account_id!==(event.account??'')||row.resource_id!==(fields.id??null))throw Error('STRIPE_EVENT_IDENTITY_MISMATCH');
}
export function markStripeInbox(db:Database,eventId:string,status:'processed'|'needs_review'|'failed'|'ignored'){
 // A concurrent failure cannot downgrade a successful application.
 db.prepare(`UPDATE stripe_webhook_inbox SET status=?,last_error=?,updated_at=datetime('now') WHERE event_id=? AND status NOT IN ('processed','ignored')`).run(status,status==='failed'?'PROVIDER_OR_DATABASE_SYNC_FAILED':status==='needs_review'?'RESOURCE_RECONCILIATION_REQUIRED':null,eventId);
}
