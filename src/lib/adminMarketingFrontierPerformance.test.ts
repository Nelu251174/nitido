import {afterEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {collectMarketingCountyWebsite,initializeMarketingCountyWeb} from './adminMarketingCountyWeb';
import type {PublicReader} from './adminMarketingPublicWeb';

let db:Database.Database|undefined;
afterEach(()=>db?.close());

describe('large persisted contact-page frontiers',()=>{
 it('keeps a collector step responsive after 330000 completed pages without losing evidence or retry state',async()=>{
  db=new Database(':memory:');
  db.exec('CREATE TABLE marketing_county_sites(job_id TEXT,website TEXT,result TEXT,warning TEXT,PRIMARY KEY(job_id,website))');
  initializeMarketingCountyWeb(db);
  const website='https://frontier.firm.ro/',job='synthetic-job';
  const insert=db.prepare("INSERT INTO marketing_county_web_pages(job_id,website,url,state,found,reason,next_attempt_at) VALUES(?,?,?,?,?,?,?)");
  const future=new Date(Date.now()+600000).toISOString();
  db.transaction(()=>{
   insert.run(job,website,website,'done','[]','',null);
   for(let i=0;i<330000;i++)insert.run(job,website,website+'page/'+i,'done','[]','',null);
   insert.run(job,website,website+'contact','done',JSON.stringify([{email:'office@example.test',source:website+'contact'}]),'',null);
   insert.run(job,website,website+'private','blocked','[]','ROBOTS_DISALLOWED',null);
   insert.run(job,website,website+'restricted','blocked','[]','HTTP_403',null);
   insert.run(job,website,website+'later','pending','[]','',future);
   insert.run('other-job',website,website+'other','done',JSON.stringify([{email:'other@example.test',source:website+'other'}]),'',null);
   db!.prepare('INSERT INTO marketing_county_sites VALUES(?,?,?,?)').run(job,website,JSON.stringify([{email:'previous@example.test',source:website+'previous'}]),'');
  })();
  // Exercise the compatible first-start index upgrade against an already populated frontier.
  db.exec('DROP INDEX marketing_county_web_evidence');
  const reader=vi.fn<PublicReader>(async()=>{throw Error('External transports must remain unused');});
  const start=performance.now();
  const tick=new Promise<number>(resolve=>setTimeout(()=>resolve(performance.now()-start),0));
  const result=await collectMarketingCountyWebsite(db,job,website,reader,()=>true);
  const timerDelayMs=await tick;
  if(process.env.NITIDO_COLLECTOR_PERF_REPORT)writeFileSync(process.env.NITIDO_COLLECTOR_PERF_REPORT,JSON.stringify({completedPages:330000,timerDelayMs}));
  console.log('FRONTIER_RESPONSIVENESS '+JSON.stringify({completedPages:330000,timerDelayMs}));
  expect(result.complete).toBe(false);
  expect(result.nextAttemptAt).toBe(future);
  expect(result.found).toEqual([{email:'previous@example.test',source:website+'previous'},{email:'office@example.test',source:website+'contact'}]);
  expect(result.warning).toContain('ROBOTS_DISALLOWED');
  expect(result.warning).toContain('HTTP_403');
  expect(reader).not.toHaveBeenCalled();
  expect(db.prepare("SELECT COUNT(*) n FROM marketing_county_web_pages WHERE job_id=? AND state='done'").get(job)).toEqual({n:330002});
  // A background bookkeeping step must not monopolize the HTTP event loop.
  expect(timerDelayMs).toBeLessThan(250);
 },15000);
});
