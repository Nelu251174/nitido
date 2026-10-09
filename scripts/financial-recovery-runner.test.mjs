import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runRecovery} from './financial-recovery-runner.mjs';
const env={NITIDO_FINANCIAL_RECOVERY_ENABLED:'true',NITIDO_FINANCIAL_RECOVERY_SECRET:'fixture-only-recovery-secret-32-characters',PORT:'3000'};
const completed={status:'completed',attempted:2,processed:1,deferred:1,failed:0};
test('disabled, missing secret and malformed ports never send credentials',async()=>{
 for(const values of [{},{...env,NITIDO_FINANCIAL_RECOVERY_ENABLED:'false'},{...env,NITIDO_FINANCIAL_RECOVERY_SECRET:'short'},{...env,PORT:'3000/foreign'},{...env,PORT:'65536'}]){
   let called=false;await assert.rejects(runRecovery({env:values,request:async()=>{called=true}}));assert.equal(called,false);
 }
});
test('loopback, no redirects, bounded request and safe counts only',async()=>{
 assert.deepEqual(await runRecovery({env,request:async(url,options)=>{
   assert.equal(url,'http://127.0.0.1:3000/api/cron/financial-recovery');assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.ok(options.signal);assert.equal(options.headers['x-recovery-secret'],env.NITIDO_FINANCIAL_RECOVERY_SECRET);
   return Response.json({...completed,secret:'must not return'});
 }}),completed);
});
test('HTTP errors and network failures do not expose response body or secret',async()=>{
 for(const request of [async()=>new Response(env.NITIDO_FINANCIAL_RECOVERY_SECRET,{status:503}),async()=>{throw Error(env.NITIDO_FINANCIAL_RECOVERY_SECRET)}])await assert.rejects(runRecovery({env,request}),e=>!e.message.includes(env.NITIDO_FINANCIAL_RECOVERY_SECRET));
});
test('rejects invalid totals, types, bounds and response format',async()=>{
 for(const data of [null,{}, {...completed,failed:2},{...completed,processed:'1'},{...completed,attempted:-1},{...completed,status:'busy'},{...completed,status:'unexpected'},{status:'completed',attempted:11,processed:11,deferred:0,failed:0}])await assert.rejects(runRecovery({env,request:async()=>Response.json(data)}));
 await assert.rejects(runRecovery({env,request:async()=>new Response('invalid')}));
});
test('busy and cooldown are confirmed skips, not processed work',async()=>{
 for(const status of ['busy','cooldown'])assert.deepEqual(await runRecovery({env,request:async()=>Response.json({status,attempted:0,processed:0,deferred:0,failed:0})}),{status,attempted:0,processed:0,deferred:0,failed:0});
});
