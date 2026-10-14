// Exercise the actual standalone proxy and server-rendered locale, using only
// local requests and synthetic IP fixtures. No account or payment actions.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const directory=path.resolve('.next/standalone');
const port=18207;
const server=spawn(process.execPath,['server.js'],{
  cwd:directory,
  env:{...process.env,HOSTNAME:'127.0.0.1',PORT:String(port)},
  stdio:['ignore','pipe','pipe'],
});
let output='';
for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{output=(output+chunk).slice(-4000);});
let failure;
server.on('error',error=>{failure=error;});
const base=`http://127.0.0.1:${port}`;
try{
  let ready=false;
  for(let attempt=0;attempt<60;attempt++){
    if(failure)throw failure;
    if(server.exitCode!==null)throw new Error('Standalone server exited before becoming ready: '+output);
    try{const response=await fetch(base+'/login',{signal:AbortSignal.timeout(2000)});ready=response.ok();}catch{}
    if(ready)break;
    await delay(250);
  }
  assert(ready,'Standalone server did not become ready: '+output);
  const fixtures=[
    {name:'Romanian IP overrides English browser',ip:'86.120.0.1',browser:'en-US,en;q=0.9',expected:'ro'},
    {name:'First client address in proxy chain',ip:'86.120.0.1, 172.18.0.1',browser:'en-US',expected:'ro'},
    {name:'French IP overrides English browser',ip:'82.120.0.1',browser:'en-US',expected:'fr'},
    {name:'Saved English overrides Romanian IP',ip:'86.120.0.1',browser:'ro-RO',manual:'en',expected:'en'},
    {name:'Unknown country falls back to browser',ip:'192.0.2.1',browser:'en-US',expected:'en'},
    {name:'Unknown country and unsupported browser default to Romanian',ip:'192.0.2.1',browser:'ja-JP',expected:'ro'},
  ];
  for(const fixture of fixtures){
    const response=await fetch(base+'/login?next=%2Fclient%23sec-lucrari',{
      headers:{'x-forwarded-for':fixture.ip,'accept-language':fixture.browser,'x-nitido-country':'FR',
        ...(fixture.manual?{cookie:`nitido-language=${fixture.manual}`}:{})},
      signal:AbortSignal.timeout(10000),
    });
    assert.equal(response.status,200,fixture.name);
    const html=await response.text();
    assert.equal(html.match(/<html[^>]*\blang="([^"]+)"/)?.[1],fixture.expected,fixture.name);
    assert.match(response.headers.get('cache-control')??'',/no-store/,fixture.name);
    console.log('Passed: '+fixture.name);
  }
  console.log('Standalone IP-language checks passed: '+fixtures.length);
}finally{
  server.kill('SIGTERM');
}
