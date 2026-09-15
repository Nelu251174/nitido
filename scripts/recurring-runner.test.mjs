import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runRecurring} from './recurring-runner.mjs';
const env={CRON_SECRET:'test-only-secret',PORT:'3000'};
test('missing secret and invalid port never issue a request',async()=>{
  for(const config of [{},{CRON_SECRET:' '},{...env,PORT:'3000/foreign'},{...env,PORT:'65536'}]){
    let called=false;await assert.rejects(runRecurring({env:config,request:async()=>{called=true}}));assert.equal(called,false);
  }
});
test('uses loopback POST without redirects and returns only a confirmed count',async()=>{
  const result=await runRecurring({env,request:async(url,init)=>{
    assert.equal(url,'http://127.0.0.1:3000/api/cron/recurring');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');assert.equal(init.headers['x-cron-secret'],env.CRON_SECRET);assert.ok(init.signal);
    return Response.json({created:2});
  }});assert.deepEqual(result,{created:2});
});
test('rejects provider failures and does not expose response bodies or connection details',async()=>{
  for(const request of [async()=>new Response(env.CRON_SECRET,{status:503}),async()=>{throw new Error(env.CRON_SECRET)}]){
    await assert.rejects(runRecurring({env,request}),error=>!error.message.includes(env.CRON_SECRET));
  }
});
test('rejects malformed success responses rather than reporting zero',async()=>{
  for(const body of [{},{created:-1},{created:1.5},{created:'0'},null])await assert.rejects(runRecurring({env,request:async()=>Response.json(body)}));
  await assert.rejects(runRecurring({env,request:async()=>new Response('not-json')}));
  assert.deepEqual(await runRecurring({env,request:async()=>Response.json({created:0})}),{created:0});
});
