import type {Database} from 'better-sqlite3';
export class CustomerRestrictionError extends Error {constructor(){super('Cererile noi de acest tip sunt restricționate pentru acest cont. Contactează support@nitido.ro. Lucrările existente rămân accesibile.');} readonly status=403;}
export function customerRestriction(db:Database,clientId:string){
 const row=db.prepare('SELECT revision,block_bookings,block_assessments,reason,actor_id,created_at FROM customer_restrictions WHERE client_id=? ORDER BY revision DESC LIMIT 1').get(clientId) as {revision:number;block_bookings:number;block_assessments:number;reason:string;actor_id:string;created_at:string}|undefined;
 return row??{revision:0,block_bookings:0,block_assessments:0,reason:null,actor_id:null,created_at:null};
}
// Call after idempotent replay checks, inside the same write transaction as creation.
export function assertCustomerCanCreate(db:Database,clientId:string,scope:'bookings'|'assessments'){
 if(!db.inTransaction)throw new Error('Restriction check requires a transaction');
 const row=customerRestriction(db,clientId);
 if(scope==='bookings'?row.block_bookings:row.block_assessments)throw new CustomerRestrictionError();
}
