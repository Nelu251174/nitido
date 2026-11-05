import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Sqlite from 'better-sqlite3';
import {initializeDatabase} from './db';
import {processPushOutbox,queueNewJobFirmPushes} from './push';
import {queueJobCreatedFirmAlerts} from './notifications';
let db:Sqlite.Database;
const price={currency:'EUR',countryCode:'FR',city:'Paris',tariffId:'synthetic-fr',revision:1,recordedAt:'2030-09-12T08:00:00Z',netMinor:10001,vatMinor:2000,vatBps:2000,grossMinor:12001,creditMinor:0,clientTotalMinor:12001,durationMinutes:180,workers:2,personMinutes:360,lines:[{code:'cleaning',amountMinor:10001},{code:'vat',amountMinor:2000}]};
const summary={id:'j',city:'Paris',spaceType:'apartament',sqm:50,scheduledAt:null};
beforeEach(()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse('2030-09-12T08:00:00Z'));vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','true');vi.stubEnv('STRIPE_SECRET_KEY','');vi.stubEnv('PUSH_ENABLED','true');vi.stubEnv('SMS_FALLBACK_ENABLED','true');
 db=new Sqlite(':memory:');initializeDatabase(db);
 db.exec("INSERT INTO users(id,role,name,phone) VALUES('c','client','Synthetic',NULL),('eligible-u','firma','Synthetic A','0722000001'),('foreign-u','firma','Synthetic B','0722000002'),('small-u','firma','Synthetic C','0722000003');");
 for(const [id,country,workers] of [['eligible','FR',2],['foreign','RO',2],['small','FR',1]] as const){
  db.prepare("INSERT INTO firms(id,user_id,coverage_city,verified,stripe_account_id,stripe_account_status,stripe_transfers_capability,stripe_identity_country,stripe_default_currency) VALUES(?,?,'Paris',1,?,'ready','active',?,'EUR')").run(id,id+'-u','acct_synthetic_'+id,country);
  db.prepare('INSERT INTO workspace_teams(id,firm_id,name) VALUES(?,?,?)').run('team-'+id,id,'Synthetic');
  db.prepare("INSERT INTO international_team_capacity(team_id,firm_id,verified_workers,verified_by,verified_at,valid_until,verification_reference) VALUES(?,?,?,'bootstrap_admin','2030-01-01','2031-01-01','synthetic-evidence')").run('team-'+id,id,workers);
  db.prepare("INSERT INTO push_devices(id,user_id,platform,device_token) VALUES(?,?,'ANDROID',?)").run('device-'+id,id+'-u','synthetic-token-'+id);
 }
 db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,buffer_minutes,status,pricing_snapshot) VALUES('j','c','Synthetic private street','Paris',50,'apartament','asap',120.01,180,30,'waiting',?)").run(JSON.stringify(price));
});
afterEach(()=>{db.close();vi.restoreAllMocks();vi.unstubAllEnvs();});
describe('EUR new job invitation outbox isolation',()=>{
 it('queues only the matching market with sufficient verified crew, without exposing street or sending',()=>{
  expect(queueNewJobFirmPushes(db,summary)).toHaveLength(1);queueNewJobFirmPushes(db,summary);
  const rows=db.prepare('SELECT recipient_user_id,message_body,data_json FROM push_notification_outbox').all() as {recipient_user_id:string;message_body:string;data_json:string}[];
  expect(rows).toHaveLength(1);expect(rows[0].recipient_user_id).toBe('eligible-u');expect(JSON.stringify(rows)).not.toContain('private street');
  expect(db.prepare('SELECT COUNT(*) n FROM provider_invitations').get()).toEqual({n:1});
 });
 it.each(["UPDATE firms SET stripe_identity_country='ES' WHERE id='eligible'","UPDATE international_team_capacity SET revoked_at='2030-09-12' WHERE firm_id='eligible'","UPDATE international_team_capacity SET verified_workers=1 WHERE firm_id='eligible'"])('revalidates before transport: %s',async mutation=>{
  const ids=queueNewJobFirmPushes(db,summary);db.exec(mutation);const sender=vi.fn();await processPushOutbox(db,ids,sender);expect(sender).not.toHaveBeenCalled();expect(db.prepare('SELECT COUNT(*) n FROM notification_outbox').get()).toEqual({n:0});
  expect(db.prepare('SELECT last_error FROM push_notification_outbox').get()).toEqual({last_error:'SUPPRESSED_FIRM_MARKET_OR_CREW'});
 });
 it('blocks fanout when rollout is closed and suppresses already queued invitations',async()=>{
  const ids=queueNewJobFirmPushes(db,summary);vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','false');expect(queueNewJobFirmPushes(db,summary)).toEqual([]);const sender=vi.fn();await processPushOutbox(db,ids,sender);expect(sender).not.toHaveBeenCalled();
 });
 it('does not infer Romanian SMS routing for an EUR job or use fallback without configured foreign transport',async()=>{
  expect(queueJobCreatedFirmAlerts(db,summary,['0722000001'])).toEqual([]);db.exec('DELETE FROM push_devices');const ids=queueNewJobFirmPushes(db,summary);await processPushOutbox(db,ids,vi.fn());expect(db.prepare('SELECT COUNT(*) n FROM notification_outbox').get()).toEqual({n:0});
 });
});
