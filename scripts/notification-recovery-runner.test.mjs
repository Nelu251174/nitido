import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runNotificationRecovery} from './notification-recovery-runner.mjs';
const env={NITIDO_NOTIFICATION_RECOVERY_ENABLED:'true',NEXT_PUBLIC_SITE_URL:'https://sandbox.nitido.ro',CRON_SECRET:'test-only-cron-secret-more-than-32-characters'};
const ok={status:'completed',recovered:1,quarantined:2,pushSelected:1,smsSelected:1};
test('uses fixed loopback endpoint, refuses redirects and returns counts only',async()=>{
 const result=await runNotificationRecovery({env,request:async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:3000/api/cron/notifications');assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.headers['x-cron-secret'],env.CRON_SECRET);assert.ok(options.signal);
  return {ok:true,json:async()=>({...ok,private:'excluded'})};
 }});assert.deepEqual(result,ok);
});
test('fails closed outside sandbox, without explicit flag, weak secret or invalid port',async()=>{
 for(const change of [{NEXT_PUBLIC_SITE_URL:'https://nitido.ro'},{NITIDO_NOTIFICATION_RECOVERY_ENABLED:'false'},{CRON_SECRET:'short'},{PORT:'3000/path'},{PORT:'65536'}]){
  await assert.rejects(runNotificationRecovery({env:{...env,...change},request:()=>assert.fail('must not call')}));
 }
});
test('rejects invalid counters and never prints provider errors or secrets',async()=>{
 for(const data of [{...ok,recovered:-1},{...ok,quarantined:201},{...ok,pushSelected:2},{...ok,smsSelected:1.5},null])await assert.rejects(runNotificationRecovery({env,request:async()=>({ok:true,json:async()=>data})}));
 await assert.rejects(runNotificationRecovery({env,request:async()=>{throw Error(env.CRON_SECRET);}}),error=>!error.message.includes(env.CRON_SECRET));
 await assert.rejects(runNotificationRecovery({env,request:async()=>({ok:false,status:401})}),/401/);
});
