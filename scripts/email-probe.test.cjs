const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./email-probe.cjs'),'utf8');
async function run({key='',fetcher=async()=>{throw Error('unexpected transport')},databaseFailure=false}={}){
 const lines=[],opens=[],sql=[],requests=[],process={env:{NEXT_PUBLIC_SITE_URL:'https://nitido.ro',RESEND_FROM:'NITIDO <support@nitido.ro>',RESEND_API_KEY:key},exitCode:0};
 class Database{
  constructor(path,options){opens.push({path,options});assert.equal(options.readonly,true);assert.equal(options.fileMustExist,true);}
  prepare(query){sql.push(query);assert.match(query,/^SELECT\b/i);if(databaseFailure)throw Error('PRIVATE_DATABASE_ERROR');return {get:(...args)=>{
   if(query.includes("name='admin_removed_accounts'"))return undefined;
   if(query.includes('FROM users WHERE email=')){assert.equal(args[0],'nelutofan@gmail.com');return {id:'synthetic-owner',role:'client',created_at:'2026-11-03T00:00:00Z'};}
   if(query.includes('FROM email_verifications'))return {expires_at:Date.now()+3600000,verified_at:null,tokenPresent:1,emailMatches:1};
   if(query.includes('FROM admin_owner_events'))return {email_status:'accepted',last_error:'<private untrusted error>'};
   return undefined;
  }};}
  pragma(query){assert.match(query,/^index_(list|info)/);return query.startsWith('index_list')?[{name:'synthetic_unique',unique:1}]:[{name:'email'}];}
  close(){this.closed=true;}
 }
 const fetch=async(url,options)=>{requests.push({url,options});return fetcher(url,options);};
 await vm.runInNewContext(source,{require:name=>{assert.equal(name,'better-sqlite3');return Database;},process,console:{log:s=>lines.push(s)},URL,AbortSignal,Date,fetch});
 assert.equal(lines.length,1);return {value:JSON.parse(lines[0]),raw:lines[0],process,opens,sql,requests};
}

test('opens only the existing database read-only and emits coarse owner metadata without a provider key',async()=>{
 const r=await run();assert.equal(r.opens.length,1);assert.equal(r.requests.length,0);assert.equal(r.value.configuration.keyPresent,false);assert.equal(r.value.account.role,'client');assert.equal(r.value.verification.tokenPresent,true);assert.equal(r.value.verification.emailMatches,true);assert.equal(r.value.ownerNotification.error,null);assert.equal(r.value.verificationSchema.uniqueEmail,true);assert.doesNotMatch(r.raw,/synthetic-owner|nelutofan@gmail.com|<private/);
});
test('filters provider results to the sender domain and existing owner confirmation metadata',async()=>{
 const r=await run({key:'synthetic-provider-key',fetcher:async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer synthetic-provider-key');
  return {ok:true,status:200,json:async()=>url.includes('/domains')?{data:[{name:'nitido.ro',status:'verified'},{name:'unrelated.invalid',status:'pending'}]}:{has_more:true,data:[{to:['nelutofan@gmail.com'],subject:'NÍTIDO — confirmă adresa',created_at:'2026-11-03T00:00:00Z',last_event:'delivered',html:'PRIVATE_BODY'},{to:['other@example.invalid'],subject:'NÍTIDO confirmare',last_event:'delivered',created_at:'PRIVATE_TIME'}]}};
 }});assert.equal(r.requests.length,2);assert.equal(r.value.senderDomainRead.matches.length,1);assert.equal(r.value.senderDomainRead.matches[0].status,'verified');assert.equal(r.value.providerRead.hasMore,true);assert.equal(r.value.providerRead.matchingVerificationMessages.length,1);assert.equal(r.value.providerRead.matchingVerificationMessages[0].event,'delivered');assert.doesNotMatch(r.raw,/synthetic-provider-key|PRIVATE_BODY|PRIVATE_TIME|other@example|unrelated.invalid|confirmă/);
});
test('redacts transport exceptions without sending any message',async()=>{
 const r=await run({key:'synthetic-provider-key',fetcher:async()=>{throw Error('PRIVATE_URL?key=synthetic-provider-key');}});assert.equal(r.requests.length,2);for(const x of r.requests){assert.equal(x.options.method,undefined);assert.match(x.url,/^https:\/\/api\.resend\.com\/(domains|emails\?limit=30)$/);}assert.equal(r.value.senderDomainRead.transportError,true);assert.equal(r.value.providerRead.transportError,true);assert.doesNotMatch(r.raw,/PRIVATE_URL|synthetic-provider-key/);
});
test('turns database/schema failure into a generic error without provider calls',async()=>{
 const r=await run({databaseFailure:true,key:'synthetic-provider-key'});assert.equal(r.process.exitCode,1);assert.equal(r.value.error,'DIAGNOSTIC_FAILED');assert.equal(r.requests.length,0);assert.doesNotMatch(r.raw,/PRIVATE_DATABASE_ERROR|synthetic-provider-key/);
});
