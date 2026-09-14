import type {Database} from 'better-sqlite3';
import type Stripe from 'stripe';
import {randomUUID} from 'node:crypto';

export const PAYOUT_RECONCILIATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS payout_reconciliation_runs (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 payout_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('matched','needs_review')),
 report_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payout_reconciliation ON payout_reconciliation_runs(account_id,payout_id,created_at);
`;

export type PayoutLine = {
 balanceId:string; sourceId:string|null; transferId:string|null; sourceChargeId:string|null; jobId:string|null;
 amountMinor:number; feeMinor:number; netMinor:number; issue:string|null;
};
export type PayoutReport = {
 id:string; accountId:string; payoutId:string; currency:string; payoutStatus:string;
 payoutAmountMinor:number; netMinor:number|null; differenceMinor:number|null;
 status:'matched'|'needs_review'; issues:string[]; lines:PayoutLine[]; checkedAt:string; mode:'test';
};
const idOf=(value:unknown):string|null=>typeof value==='string'?value:value&&typeof value==='object'&&'id' in value&&typeof value.id==='string'?value.id:null;
function requireDetail(ok:unknown){if(!ok)throw Error('PAYOUT_RECONCILIATION_DETAILS_MISMATCH');}
type LocalPayment={id:string;job_id:string;amount_net:number;status:string;transfer_status:string;refund_status:string;stripe_charge_id:string|null;stripe_account_id:string};

/** Sandbox-only, provider GETs only. Never changes payment, transfer or bank-payout status. */
export async function reconcileSandboxPayout(db:Database,stripe:Stripe,accountId:string,payoutId:string):Promise<PayoutReport>{
 const deadline=Date.now()+30000;
 function withinDeadline(){if(Date.now()>deadline)throw Error('PAYOUT_RECONCILIATION_TIME_LIMIT');}
 const firms=db.prepare('SELECT id FROM firms WHERE stripe_account_id=?').all(accountId);
 if(firms.length!==1||!db.prepare('SELECT 1 FROM stripe_bank_payouts WHERE account_id=? AND payout_id=?').get(accountId,payoutId))throw Error('PAYOUT_RECONCILIATION_UNKNOWN_ACCOUNT');
 const context={stripeAccount:accountId};
 const payout=await stripe.payouts.retrieve(payoutId,{},context);
 requireDetail(payout.id===payoutId&&payout.livemode===false&&Number.isSafeInteger(payout.amount)&&payout.amount>0);
 const report:PayoutReport={id:randomUUID(),accountId,payoutId,currency:payout.currency,payoutStatus:payout.status,payoutAmountMinor:payout.amount,netMinor:null,differenceMinor:null,status:'needs_review',issues:[],lines:[],checkedAt:new Date().toISOString(),mode:'test'};
 if(!payout.automatic)report.issues.push('MANUAL_PAYOUT_REQUIRES_EXTERNAL_RECONCILIATION');
 if(payout.reconciliation_status!=='completed')report.issues.push('PROVIDER_RECONCILIATION_NOT_READY');
 if(payout.status!=='paid')report.issues.push('PAYOUT_NOT_PAID');
 if(payout.currency!=='ron')report.issues.push('UNSUPPORTED_CURRENCY');
 // Stripe's payout filter only supports automatic payouts. Never infer membership by dates or amount.
 if(!payout.automatic||payout.reconciliation_status!=='completed'||payout.currency!=='ron')return save(db,report);
 let cursor:string|undefined;
 const seen=new Set<string>(),transfers=new Set<string>();
 for(let page=0;page<10;page++){
   withinDeadline();
   const balances=await stripe.balanceTransactions.list({payout:payoutId,limit:100,...(cursor?{starting_after:cursor}:{})},context);
   requireDetail(Array.isArray(balances.data)&&typeof balances.has_more==='boolean');
   for(const balance of balances.data){
     withinDeadline();
     requireDetail(typeof balance.id==='string'&&!seen.has(balance.id)&&balance.currency===payout.currency&&[balance.amount,balance.fee,balance.net].every(Number.isSafeInteger)&&balance.amount-balance.fee===balance.net);
     seen.add(balance.id);
     const line:PayoutLine={balanceId:balance.id,sourceId:idOf(balance.source),transferId:null,sourceChargeId:null,jobId:null,amountMinor:balance.amount,feeMinor:balance.fee,netMinor:balance.net,issue:null};
     // Other adjustments remain explicit exceptions, even if the overall totals happen to match.
     if(!['payment','charge'].includes(balance.type)||!line.sourceId){line.issue='UNMAPPED_BALANCE_TRANSACTION';report.lines.push(line);continue;}
     const charge=await stripe.charges.retrieve(line.sourceId,{},context);
     requireDetail(charge.id===line.sourceId&&charge.livemode===false&&idOf(charge.balance_transaction)===balance.id&&charge.currency===balance.currency&&charge.amount===balance.amount);
     line.transferId=idOf(charge.source_transfer);
     if(!line.transferId){line.issue='SOURCE_TRANSFER_MISSING';report.lines.push(line);continue;}
     withinDeadline();
     const transfer=await stripe.transfers.retrieve(line.transferId);
     line.sourceChargeId=idOf(transfer.source_transaction);
     requireDetail(transfer.id===line.transferId&&transfer.livemode===false&&idOf(transfer.destination)===accountId&&idOf(transfer.destination_payment)===charge.id&&transfer.currency===balance.currency&&transfer.amount===balance.amount);
     const local=db.prepare(`SELECT p.id,p.job_id,p.amount_net,p.status,p.transfer_status,p.refund_status,p.stripe_charge_id,f.stripe_account_id
       FROM payments p JOIN jobs j ON j.id=p.job_id JOIN firms f ON f.id=j.accepted_firm_id WHERE p.stripe_transfer_id=?`).all(transfer.id) as LocalPayment[];
     if(local.length!==1){line.issue='LOCAL_TRANSFER_MISSING_OR_AMBIGUOUS';}
     else {
       const payment=local[0];
       if(payment.stripe_account_id!==accountId||!Number.isSafeInteger(payment.amount_net*100)||payment.amount_net*100!==transfer.amount||!payment.stripe_charge_id||idOf(transfer.source_transaction)!==payment.stripe_charge_id){line.issue='LOCAL_PAYMENT_MISMATCH';}
       else {line.jobId=payment.job_id;if(transfer.reversed||transfer.amount_reversed!==0||payment.status!=='captured'||payment.transfer_status!=='processed'||payment.refund_status!=='none')line.issue='PAYMENT_REQUIRES_REVIEW';}
     }
     if(transfers.has(transfer.id))line.issue='DUPLICATE_TRANSFER';
     transfers.add(transfer.id);report.lines.push(line);
   }
   if(!balances.has_more)break;
   requireDetail(balances.data.length>0&&page<9);
   cursor=balances.data.at(-1)!.id;
 }
 // A changing payout or local account mapping cannot produce a green result from a stale read.
 withinDeadline();
 const current=await stripe.payouts.retrieve(payoutId,{},context);
 requireDetail(current.id===payout.id&&current.livemode===false&&current.amount===payout.amount&&current.currency===payout.currency&&current.status===payout.status&&current.automatic===payout.automatic&&current.reconciliation_status===payout.reconciliation_status);
 report.netMinor=report.lines.reduce((sum,line)=>sum+line.netMinor,0);
 requireDetail(Number.isSafeInteger(report.netMinor));
 report.differenceMinor=payout.amount-report.netMinor;
 requireDetail(Number.isSafeInteger(report.differenceMinor));
 if(!report.lines.length)report.issues.push('NO_BALANCE_TRANSACTIONS');
 if(report.differenceMinor!==0)report.issues.push('TOTAL_MISMATCH');
 if(report.lines.some(line=>line.issue))report.issues.push('UNRESOLVED_LINES');
 report.status=report.issues.length?'needs_review':'matched';
 return save(db,report);
}

function save(db:Database,report:PayoutReport):PayoutReport{
 db.transaction(()=>{
   if(db.prepare('SELECT id FROM firms WHERE stripe_account_id=?').all(report.accountId).length!==1)throw Error('PAYOUT_RECONCILIATION_ACCOUNT_CHANGED');
   // Recheck every mapped local row after the external reads, inside the recording transaction.
   for(const line of report.lines.filter(line=>line.jobId)){
     const rows=db.prepare(`SELECT p.job_id,p.amount_net,p.status,p.transfer_status,p.refund_status,p.stripe_charge_id,f.stripe_account_id FROM payments p JOIN jobs j ON j.id=p.job_id JOIN firms f ON f.id=j.accepted_firm_id WHERE p.stripe_transfer_id=?`).all(line.transferId) as LocalPayment[];
     const p=rows[0];
     if(rows.length!==1||p.job_id!==line.jobId||p.stripe_account_id!==report.accountId||p.stripe_charge_id!==line.sourceChargeId||p.amount_net*100!==line.amountMinor||p.status!=='captured'||p.transfer_status!=='processed'||p.refund_status!=='none'){
       line.issue='LOCAL_STATE_CHANGED';report.status='needs_review';if(!report.issues.includes('LOCAL_STATE_CHANGED'))report.issues.push('LOCAL_STATE_CHANGED');
     }
   }
   db.prepare('INSERT INTO payout_reconciliation_runs(id,account_id,payout_id,status,report_json) VALUES(?,?,?,?,?)').run(report.id,report.accountId,report.payoutId,report.status,JSON.stringify(report));
   db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),'SANDBOX_PAYOUT_RECONCILED',report.payoutId,JSON.stringify({reportId:report.id,accountId:report.accountId,status:report.status}));
 })();
 return report;
}
