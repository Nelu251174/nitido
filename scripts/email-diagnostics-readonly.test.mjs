import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {redactEmailMetadata,runEmailDiagnosis,senderDomainReadOnly,existingEmailEventsReadOnly} from './email-diagnostics-readonly.mjs';
test('redacts arbitrary provider/account payload and does not equate acceptance with delivery',()=>{
 const result=redactEmailMetadata({configuration:{keyPresent:true,key:'PRIVATE_KEY'},records:[{correlationId:'not-an-id',createdAt:'not-a-date',stage:'PRIVATE_STAGE',category:'PRIVATE_ERROR',messageId:'recipient@example.test',httpStatus:999,accepted:1,attempts:1,to:'PRIVATE_RECIPIENT',html:'PRIVATE_TOKEN',password:'PRIVATE_PASSWORD'}]});
 assert.equal(result.deliveryConfirmed,false);assert.equal(result.records[0].accepted,true);assert.equal(result.records[0].messageId,null);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|recipient@example/);
});
test('fixture and local database diagnosis send nothing and leave the database unchanged',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nitido-email-fixture-')),path=join(dir,'fixture.json');writeFileSync(path,JSON.stringify({records:[]}));
 try{
  let calls=0;const transport=async()=>{calls++;throw Error('network forbidden')};const result=await runEmailDiagnosis(['--fixture',path],{transport,env:{}});assert.equal(result.evidence,'isolated_fixture_not_live');await assert.rejects(runEmailDiagnosis(['--fixture',path,'--provider-domains'],{transport,env:{}}));await assert.rejects(runEmailDiagnosis(['--fixture',path,'--provider-events'],{transport,env:{}}));
  const Database=createRequire(import.meta.url)('better-sqlite3'),database=join(dir,'synthetic.db'),db=new Database(database);
  db.exec('CREATE TABLE email_delivery_diagnostics(correlation_id TEXT,user_id TEXT,created_at INTEGER,stage TEXT,category TEXT,http_status INTEGER,provider_message_id TEXT,accepted INTEGER,attempts INTEGER)');
  db.prepare('INSERT INTO email_delivery_diagnostics VALUES(?,?,?,?,?,?,?,?,?)').run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','opaque-user',Date.now(),'provider','provider_accepted',200,null,1,1);db.close();
  const digest=()=>createHash('sha256').update(readFileSync(database)).digest('hex'),before=digest();
  const runtime=await runEmailDiagnosis(['--database',database,'--user-id','opaque-user'],{transport,env:{}});assert.equal(runtime.records.length,1);assert.equal(runtime.deliveryConfirmed,false);assert.equal(digest(),before);assert.equal(calls,0);assert.doesNotMatch(JSON.stringify(runtime),/opaque-user/);
  const missing=join(dir,'missing.db');await assert.rejects(runEmailDiagnosis(['--database',missing,'--user-id','opaque-user'],{transport,env:{}}));assert.equal(existsSync(missing),false);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('provider diagnosis issues only bounded GETs and emits whitelisted domain/event metadata',async()=>{
 const calls=[];const transport=async(url,init)=>{calls.push({url,init});return Response.json({data:[{name:'example.test',status:'verified',private:'PRIVATE_PROVIDER_TEXT'}]})};
 const result=await senderDomainReadOnly({RESEND_API_KEY:'PRIVATE_KEY',RESEND_FROM:'NITIDO <mail@example.test>'},transport);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.resend.com/domains');assert.equal(calls[0].init.method,'GET');assert.equal(result.status,'verified');assert.doesNotMatch(JSON.stringify(result),/PRIVATE|mail@example/);
 const eventCalls=[],messageId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const events=await existingEmailEventsReadOnly({RESEND_API_KEY:'PRIVATE_KEY'},[messageId],async(url,init)=>{eventCalls.push({url,init});return Response.json({has_more:false,data:[{id:messageId,last_event:'delivered',created_at:'2026-11-02T12:00:00Z',to:['PRIVATE_RECIPIENT'],html:'PRIVATE_BODY',secret:'PRIVATE_TOKEN'},{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',last_event:'PRIVATE_OTHER_EVENT'}]})});
 assert.equal(eventCalls.length,1);assert.equal(eventCalls[0].url,'https://api.resend.com/emails?limit=100');assert.equal(eventCalls[0].init.method,'GET');assert.equal(events.records.length,1);assert.equal(events.providerDeliveryReported,true);assert.equal(events.inboxReceptionVerified,false);assert.doesNotMatch(JSON.stringify(events),/PRIVATE/);
});
test('a send-only credential lacking GET permission is not misreported as invalid sending configuration',async()=>{
 const result=await senderDomainReadOnly({RESEND_API_KEY:'fixture',RESEND_FROM:'mail@example.test'},async()=>new Response('PRIVATE_ERROR',{status:403}));assert.deepEqual(result,{available:false,httpStatus:403,reason:'read_permission_unavailable'});
});

test('malformed fixture rows cannot expose or crash redacted diagnostics',()=>{
 const data=redactEmailMetadata({records:[null,undefined,'PRIVATE_STRING',[],42,{stage:'verification',category:'verification_busy',attempts:0}]});
 assert.equal(data.records.length,6);assert.equal(data.records[5].category,'verification_busy');assert.doesNotMatch(JSON.stringify(data),/PRIVATE/);
});
test('existing pre-diagnostic schema yields safe account and verification states without reading secret values',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nitido-email-state-')),database=join(dir,'synthetic.db');
 const Database=createRequire(import.meta.url)('better-sqlite3');const db=new Database(database),now=Date.now();
 try{
  db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT,email TEXT);CREATE TABLE email_verifications(user_id TEXT PRIMARY KEY,email TEXT,token_hash TEXT,expires_at INTEGER,verified_at INTEGER);CREATE TABLE admin_removed_accounts(user_id TEXT PRIMARY KEY);CREATE TABLE email_verification_send_leases(user_id TEXT PRIMARY KEY,lease_id TEXT,expires_at INTEGER)');
  db.prepare('INSERT INTO users VALUES(?,?,?)').run('opaque-user','client','PRIVATE_RECIPIENT@example.test');
  const inspect=()=>runEmailDiagnosis(['--database',database,'--user-id','opaque-user'],{env:{},transport:()=>{throw Error('Network forbidden')}});
  let r=await inspect();assert.equal(r.schemaAvailable,false);assert.equal(r.accountState.linkState,'not_issued');
  db.prepare('INSERT INTO email_verifications VALUES(?,?,?,?,?)').run('opaque-user','PRIVATE_RECIPIENT@example.test','PRIVATE_HASH',now+60000,null);
  r=await inspect();assert.equal(r.accountState.linkState,'valid_unexpired');assert.equal(r.accountState.verified,false);
  db.prepare('UPDATE email_verifications SET expires_at=?').run(now-1);assert.equal((await inspect()).accountState.linkState,'expired');
  db.exec("UPDATE email_verifications SET token_hash=NULL,expires_at=NULL,verified_at=1");r=await inspect();assert.equal(r.accountState.verified,true);assert.equal(r.accountState.linkState,'confirmed');
  db.exec("UPDATE users SET email='CHANGED_PRIVATE@example.test'");assert.equal((await inspect()).accountState.linkState,'address_changed');
  db.exec("INSERT INTO admin_removed_accounts VALUES('opaque-user')");assert.equal((await inspect()).accountState.linkState,'account_inactive');
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE|opaque-user|token_hash|PRIVATE_HASH/);
  const before=createHash('sha256').update(readFileSync(database)).digest('hex');await inspect();assert.equal(createHash('sha256').update(readFileSync(database)).digest('hex'),before);
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
