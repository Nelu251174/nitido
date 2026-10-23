import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {installApnsRuntime} from './apns-runtime-install.mjs';
import {APNS_IDENTITY} from './apns-credential-check.mjs';

test('refused server access never sends the APNs key or mutates either environment',async()=>{
  const calls=[];
  await assert.rejects(installApnsRuntime({COOLIFY_TOKEN:'synthetic-token',APNS_PRIVATE_KEY:'synthetic-secret'},async(url,options)=>{calls.push({url,options});return {ok:false,status:401}}),/^Error: COOLIFY_HTTP_401$/);
  assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.body,undefined);
  assert.equal(calls[0].url,'https://coolify.nitido.ro/api/v1/applications/civaeb8joydtchvzlen6pivq');
});

test('installation targets only existing NITIDO servers with runtime-only locked secrets and delivery disabled',async()=>{
  const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({type:'pkcs8',format:'pem'});
  const envs=new Map(),requests=[];
  const targetSites={'civaeb8joydtchvzlen6pivq':'https://sandbox.nitido.ro','zxnelxi2cejranyvfpw0scac':'https://nitido.ro'};
  const fetcher=async(url,options)=>{
    const u=new URL(url),match=u.pathname.match(/^\/api\/v1\/applications\/([^/]+)(\/envs|\/restart)?$/);assert.ok(match);assert.ok(targetSites[match[1]]);
    const id=match[1],part=match[2],body=options.body?JSON.parse(options.body):undefined;
    requests.push({id,part,method:options.method,body});let data;
    if(!part)data={status:'running:healthy',git_commit_sha:'0e7796447555737acccc4c1400fc43d120934ac4',fqdn:targetSites[id]};
    else if(part==='/restart')data={deployment_uuid:'synthetic-restart-'+id};
    else if(options.method==='GET')data=envs.get(id)??[];
    else{assert.equal(body.is_runtime,true);assert.equal(body.is_buildtime,false);assert.equal(body.is_shown_once,true);assert.equal(body.is_literal,true);assert.equal(body.is_preview,false);const all=envs.get(id)??[];all.push(body);envs.set(id,all);data={};}
    return {ok:true,status:200,json:async()=>data};
  };
  const result=await installApnsRuntime({COOLIFY_TOKEN:'synthetic-token',APNS_PRIVATE_KEY:key,APPLE_TEAM_ID:APNS_IDENTITY.teamId},fetcher);
  assert.equal(result.servers.length,2);assert.equal(result.pushDeliveryEnabled,false);assert.equal(JSON.stringify(result).includes('PRIVATE KEY'),false);
  assert.equal(requests.filter(x=>x.part==='/restart').length,2);
  for(const all of envs.values()){
    assert.deepEqual(all.map(x=>x.key).sort(),['PUSH_ENABLED','APNS_KEY_ID','APNS_TEAM_ID','APNS_BUNDLE_ID','APNS_USE_SANDBOX','APNS_PRIVATE_KEY'].sort());
    assert.equal(all.find(x=>x.key==='PUSH_ENABLED').value,'false');assert.equal(all.find(x=>x.key==='APNS_PRIVATE_KEY').value,key);
  }
});
