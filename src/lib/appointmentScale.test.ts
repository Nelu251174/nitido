import {performance} from 'node:perf_hooks';
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {it,expect,vi} from 'vitest';
import {initializeDatabase} from './db';
import {queueAppointmentReminders} from './appointmentReminders';

it('stages 10,000 synthetic appointments in bounded batches without starvation or mutation',()=>{
 const db=new Database(':memory:');
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2027-03-27T12:00:00Z'));vi.stubEnv('NITIDO_APPOINTMENT_REMINDERS_ENABLED','true');
 try{
  db.pragma('foreign_keys=ON');initializeDatabase(db);
  db.exec("INSERT INTO users(id,role,name) VALUES('scale-client','client','Synthetic'),('scale-owner','firma','Synthetic');INSERT INTO firms(id,user_id,verified,coverage_city) VALUES('scale-firm','scale-owner',1,'Test')");
  const insert=db.prepare("INSERT INTO jobs(id,client_id,city,street,sqm,space_type,mode,when_type,scheduled_at,price_gross,duration_minutes,buffer_minutes,status,accepted_firm_id) VALUES(?,'scale-client','Test','Synthetic',80,'apartament','standard','scheduled','2027-03-28T10:00:00.000Z',550,180,30,'accepted','scale-firm')");
  db.transaction(()=>{for(let i=0;i<10000;i++)insert.run('scale-'+String(i).padStart(5,'0'));}).immediate();
  const before=db.prepare('SELECT id,status,scheduled_at,price_gross,accepted_firm_id FROM jobs ORDER BY id').all();
  const times:number[]=[];let queued=0;
  for(let i=0;i<21;i++){const start=performance.now();const result=queueAppointmentReminders(db);times.push(performance.now()-start);expect(result.queued).toBeLessThanOrEqual(500);queued+=result.queued;}
  expect(queued).toBe(10000);expect(queueAppointmentReminders(db).queued).toBe(0);
  expect(db.prepare("SELECT COUNT(DISTINCT job_id) count FROM appointment_reminders WHERE channel='inapp'").get()).toEqual({count:10000});
  expect(db.prepare('SELECT id,status,scheduled_at,price_gross,accepted_firm_id FROM jobs ORDER BY id').all()).toEqual(before);
  expect(db.prepare('SELECT COUNT(*) count FROM workspace_notices').get()).toEqual({count:0});
  expect(db.prepare('SELECT COUNT(*) count FROM payments').get()).toEqual({count:0});
  const sorted=[...times].sort((a,b)=>a-b),report={scope:'Synthetic in-memory queue staging only; no HTTP, external delivery or production capacity claim',appointments:10000,batches:21,p95BatchMs:sorted[Math.ceil(sorted.length*.95)-1],maxBatchMs:sorted.at(-1),totalStagingMs:times.reduce((a,b)=>a+b,0)};
  if(process.env.NITIDO_SCALE_EVIDENCE_DIR){mkdirSync(process.env.NITIDO_SCALE_EVIDENCE_DIR,{recursive:true});writeFileSync(join(process.env.NITIDO_SCALE_EVIDENCE_DIR,'appointment-scale.json'),JSON.stringify(report,null,2));}
 }finally{db.close();vi.useRealTimers();vi.unstubAllEnvs();}
},30000);
