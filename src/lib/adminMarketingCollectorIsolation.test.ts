import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {fork,execFileSync,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {initializeMarketingCounty} from './adminMarketingCounty';
import {marketingCollectorEnvironment} from './adminMarketingCollectorProcess';

it('keeps HTTP responsive during a blocked collector child, then resumes its persisted synthetic frontier without external requests',async()=>{
 execFileSync(process.execPath,['scripts/build-marketing-collector.mjs']);
 const root=mkdtempSync(join(tmpdir(),'nitido-collector-isolation-')),file=join(root,'synthetic.db');
 const db=new Database(file);db.pragma('journal_mode = WAL');initializeMarketingCounty(db);
 db.exec('CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');
 const website='https://frontier.firm.ro/',future=new Date(Date.now()+600000).toISOString(),at=new Date().toISOString();
 db.prepare("INSERT INTO marketing_county_jobs(id,county_code,position,state,created_at,updated_at,created_by) VALUES('job','MS',0,'collecting',?,?,'synthetic')").run(at,at);
 db.prepare("INSERT INTO marketing_county_items(id,job_id,identity,name,category,city,website,phone,source) VALUES('item','job','osm:node/1','Synthetic','business','Synthetic',?,'',?)").run(website,website);
 db.prepare("INSERT INTO marketing_directory_pages(job_id,url,kind,state) VALUES('job','https://www.ghidul.ro/sumar','index','done')").run();
 const insert=db.prepare("INSERT INTO marketing_county_web_pages(job_id,website,url,state,next_attempt_at) VALUES('job',?,?,?,?)");
 db.transaction(()=>{
  insert.run(website,website,'done',null);
  for(let i=0;i<330000;i++)insert.run(website,website+'page/'+i,'done',null);
  insert.run(website,website+'later','pending',future);
 })();
 const preload=join(root,'isolated-preload.cjs');
 writeFileSync(preload,`
  const https=require('node:https'),dns=require('node:dns/promises');
  https.request=()=>{process.send?.({type:'external-request'});throw Error('OUTBOUND_DISABLED');};
  dns.lookup=async()=>{process.send?.({type:'external-request'});throw Error('OUTBOUND_DISABLED');};
  process.send?.({type:'synthetic-busy'});
  const until=Date.now()+2000;while(Date.now()<until){};
 `);
 const server=createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end('{"status":"ok"}');});
 let child:ChildProcess|undefined;
 const external:string[]=[],timings:number[]=[];
 let resolveBusy:()=>void=()=>{},resolveBatch:()=>void=()=>{};
 const busy=new Promise<void>(r=>{resolveBusy=r;}),batch=new Promise<void>(r=>{resolveBatch=r;});
 const deadline=(p:Promise<void>)=>Promise.race([p,new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('Synthetic collector deadline')),10000).unref())]);
 try{
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const address=server.address();if(!address||typeof address==='string')throw Error('No loopback address');
  child=fork(resolve('scripts/runtime/marketing-collector.cjs'),[file],{
   execArgv:['--max-old-space-size=256','--require',preload],
   env:marketingCollectorEnvironment({...process.env,NEXT_PUBLIC_SITE_URL:'https://nitido.ro',NITIDO_MARKETING_ADMIN_ENABLED:'true',NITIDO_MARKETING_DELIVERY_ENABLED:'false'}),
   stdio:['ignore','pipe','pipe','ipc'],
  });
  child.on('message',message=>{
   const type=(message as {type?:string}).type;
   if(type==='synthetic-busy')resolveBusy();
   if(type==='external-request')external.push(type);
  });
  child.stdout?.on('data',chunk=>{if(String(chunk).includes('MKT_COLLECTOR_PACE'))resolveBatch();});
  await deadline(busy);
  for(let i=0;i<5;i++){
   const start=performance.now();
   const response=await fetch('http://127.0.0.1:'+address.port+'/api/health');
   expect(response.status).toBe(200);expect(await response.json()).toEqual({status:'ok'});
   timings.push(performance.now()-start);
   await new Promise(r=>setTimeout(r,100));
  }
  expect(Math.max(...timings)).toBeLessThan(500);
  await deadline(batch);
  expect(external).toEqual([]);
  expect(db.prepare("SELECT state FROM marketing_county_jobs WHERE id='job'").get()).toEqual({state:'collecting'});
  expect(db.prepare("SELECT next_attempt_at FROM marketing_county_items WHERE id='item'").get()).toEqual({next_attempt_at:future});
  expect(db.prepare('SELECT COUNT(*) n FROM marketing_county_web_pages').get()).toEqual({n:330002});
  expect(db.pragma('integrity_check',{simple:true})).toBe('ok');
  if(process.env.NITIDO_COLLECTOR_ISOLATION_REPORT)writeFileSync(process.env.NITIDO_COLLECTOR_ISOLATION_REPORT,JSON.stringify({httpChecks:timings.length,maxHealthMilliseconds:Math.max(...timings),syntheticChildBlockingMilliseconds:2000,persistedPages:330002,externalRequests:external.length}));
 }finally{
  if(child&&child.exitCode===null){
   child.kill('SIGTERM');
   await Promise.race([new Promise(r=>child!.once('exit',r)),new Promise(r=>setTimeout(r,2000))]);
   if(child.exitCode===null)child.kill('SIGKILL');
  }
  await new Promise<void>((r,reject)=>server.close(e=>e?reject(e):r()));
  db.close();rmSync(root,{recursive:true,force:true});
 }
},20000);
