import {beforeEach,afterEach,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {EMAIL_DELIVERY_DIAGNOSTIC_SCHEMA,emailDiagnostics,recordEmailDiagnostic} from './emailDeliveryDiagnostics';
import {emailFailure} from './email';
let db:Database.Database;
beforeEach(()=>{db=new Database(':memory:');db.exec(EMAIL_DELIVERY_DIAGNOSTIC_SCHEMA)});
afterEach(()=>db.close());
it('retains bounded metadata and excludes expired records',()=>{
 const now=Date.now(),insert=db.prepare('INSERT INTO email_delivery_diagnostics VALUES(?,?,?,?,?,?,?,?,?)');
 db.transaction(()=>{for(let i=0;i<2001;i++)insert.run(`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,'opaque-user',now-1,'provider','provider_accepted',200,null,1,1);insert.run('old','opaque-user',now-31*86400000,'provider','provider_accepted',200,null,1,1)})();
 expect(recordEmailDiagnostic(db,'opaque-user',emailFailure('not_configured','configuration'),now)).toBe(true);expect(db.prepare('SELECT COUNT(*) n FROM email_delivery_diagnostics').get()).toEqual({n:2000});expect(db.prepare("SELECT 1 FROM email_delivery_diagnostics WHERE correlation_id='old'").get()).toBeUndefined();
 const data=emailDiagnostics(db,100,now);expect(data.items).toHaveLength(100);expect(data.counts).toEqual({accepted:1999,unavailable:1});expect(data.deliveryConfirmed).toBe(false);expect(JSON.stringify(data)).not.toContain('opaque-user');
});
it('does not reflect arbitrary stored strings or invalid dates into the administrator response',()=>{
 db.prepare('INSERT INTO email_delivery_diagnostics VALUES(?,?,?,?,?,?,?,?,?)').run('PRIVATE_ADDRESS@example.test','PRIVATE_USER',9e20,'PRIVATE_STAGE','PRIVATE_PROVIDER_BODY',999,'PRIVATE_TOKEN',1,900);
 const row=emailDiagnostics(db).items[0];expect(row).toMatchObject({correlationId:null,createdAt:null,stage:'unknown',category:'unknown',httpStatus:null,messageId:null,attempts:null});expect(JSON.stringify(row)).not.toContain('PRIVATE');
});
it('a missing diagnostic schema remains a non-fatal recording failure',()=>{db.exec('DROP TABLE email_delivery_diagnostics');expect(recordEmailDiagnostic(db,'opaque-user',emailFailure('not_configured','configuration'))).toBe(false)});
