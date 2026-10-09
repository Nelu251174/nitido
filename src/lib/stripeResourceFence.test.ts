import {afterEach,describe,it,expect} from 'vitest';
import Sqlite from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {STRIPE_INBOX_SCHEMA,stripeResourceFence} from './stripeInbox';

const dirs:string[]=[];
afterEach(()=>{for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
describe('persistent resource version fencing',()=>{
 it('rejects stale work across independent database connections and rolls back all acquired versions',()=>{
   const dir=mkdtempSync(join(tmpdir(),'nitido-fence-'));dirs.push(dir);
   const a=new Sqlite(join(dir,'db.sqlite')),b=new Sqlite(join(dir,'db.sqlite'));
   try{
     a.exec(STRIPE_INBOX_SCHEMA);
     const first=stripeResourceFence(a),second=stripeResourceFence(b);
     first.watch('unrelated');first.watch('payout:acct:po');second.watch('payout:acct:po');
     b.transaction(()=>second.commit())();
     expect(()=>a.transaction(()=>first.commit())()).toThrow('STRIPE_RESOURCE_CHANGED');
     expect(a.prepare('SELECT version FROM stripe_resource_versions WHERE resource_key=?').get('unrelated')).toEqual({version:0});
     expect(a.prepare('SELECT version FROM stripe_resource_versions WHERE resource_key=?').get('payout:acct:po')).toEqual({version:1});
   }finally{a.close();b.close();}
 });
 it('requires a transaction and rolls back versions when effects fail',()=>{
   const db=new Sqlite(':memory:');
   try{
     db.exec(STRIPE_INBOX_SCHEMA);const fence=stripeResourceFence(db);fence.watch('intent:pi');
     expect(()=>fence.commit()).toThrow('STRIPE_RESOURCE_TRANSACTION_REQUIRED');
     expect(()=>db.transaction(()=>{fence.commit();throw Error('effect failed');})()).toThrow('effect failed');
     expect(db.prepare('SELECT version FROM stripe_resource_versions').get()).toEqual({version:0});
     db.transaction(()=>fence.commit())();expect(db.prepare('SELECT version FROM stripe_resource_versions').get()).toEqual({version:1});
   }finally{db.close();}
 });
});
