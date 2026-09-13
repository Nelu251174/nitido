import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
import {SCHEMA_SQL} from './db';
import {processPushOutbox,queueNewJobFirmPushes} from './push';
import {sendSmsViaTwilio} from './sms';
import {PushProviderError} from './pushProviders';

vi.mock('./sms',async importOriginal=>({
  ...await importOriginal<typeof import('./sms')>(),
  sendSmsViaTwilio:vi.fn(async()=>({providerMessageId:'test-sms'})),
}));

describe('push delivery revalidates queued recipients',()=>{
  let db:InstanceType<typeof Database>;
  const queue=()=>queueNewJobFirmPushes(db,{id:'job',city:'Constanta',spaceType:'apartament',sqm:55});
  const addDevice=(id:string)=>db.prepare('INSERT INTO push_devices(id,user_id,platform,device_token) VALUES(?,?,?,?)').run(id,'firm-user','IOS',id+'-test-token');
  beforeEach(()=>{
    db=new Database(':memory:');db.exec(SCHEMA_SQL);
    db.exec(`INSERT INTO users(id,role,name,phone) VALUES
      ('client','client','Client','0721000000'),('firm-user','firma','Firm','0722000000'),('other','client','Other','0723000000');
      INSERT INTO firms(id,user_id,coverage_city,verified) VALUES('firm','firm-user','Constanta',1);
      INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status)
      VALUES('job','client','Private address','Constanta',55,'apartament','asap',400,120,'waiting');`);
    process.env.PUSH_ENABLED='true';process.env.SMS_FALLBACK_ENABLED='true';vi.clearAllMocks();
  });
  afterEach(()=>{db.close();delete process.env.PUSH_ENABLED;delete process.env.SMS_FALLBACK_ENABLED;});
  it.each([
    "UPDATE push_devices SET revoked_at=datetime('now')",
    'UPDATE push_devices SET push_enabled=0',
    "UPDATE push_devices SET user_id='other'",
  ])('does not send to an unavailable or reassigned device: %s',async change=>{
    addDevice('d1');const ids=queue();db.exec(change);
    const sender=vi.fn(async()=>({providerMessageId:'unexpected'}));
    await processPushOutbox(db,ids,sender);expect(sender).not.toHaveBeenCalled();
  });
  it.each([
    'UPDATE firms SET verified=0',
    "UPDATE firms SET suspended_until='2999-01-01T00:00:00Z'",
    "UPDATE firms SET coverage_city='Brasov'",
    "UPDATE jobs SET status='accepted',accepted_firm_id='firm'",
    "UPDATE jobs SET status='cancelled'",
    "INSERT INTO notification_preferences(user_id,new_job_alerts) VALUES('firm-user',0)",
  ])('suppresses both push and fallback after eligibility changes: %s',async change=>{
    addDevice('d1');const ids=queue();db.exec(change);
    const sender=vi.fn(async()=>({providerMessageId:'unexpected'}));
    await processPushOutbox(db,ids,sender);await processPushOutbox(db,undefined,sender);
    expect(sender).not.toHaveBeenCalled();expect(sendSmsViaTwilio).not.toHaveBeenCalled();
    expect((db.prepare('SELECT last_error FROM push_notification_outbox').get() as {last_error:string}).last_error).toMatch(/^SUPPRESSED_/);
  });
  it('re-reads the next device after a send yields',async()=>{
    addDevice('d1');addDevice('d2');const ids=queue();
    const sender=vi.fn(async()=>{db.exec("UPDATE push_devices SET revoked_at=datetime('now') WHERE id='d2'");return {providerMessageId:'first'};});
    await processPushOutbox(db,ids,sender);expect(sender).toHaveBeenCalledTimes(1);
  });
  it('does not turn an explicit empty batch into a global dispatch',async()=>{
    addDevice('d1');queue();const sender=vi.fn(async()=>({providerMessageId:'unexpected'}));
    await processPushOutbox(db,[],sender);expect(sender).not.toHaveBeenCalled();
  });
  it('caps missing-device retries and preserves terminal rows',async()=>{
    const ids=queue();for(let i=0;i<6;i++)await processPushOutbox(db,ids);
    expect((db.prepare('SELECT attempt_count FROM push_notification_outbox').get() as {attempt_count:number}).attempt_count).toBeLessThanOrEqual(3);
    expect(sendSmsViaTwilio).toHaveBeenCalledTimes(1);
  });
  it('does not send fallback while another worker is sending the push',async()=>{
    addDevice('d1');const ids=queue();let release!:()=>void;
    const waiting=new Promise<void>(resolve=>{release=resolve;});
    const sender=vi.fn(async()=>{await waiting;return {providerMessageId:'first'};});
    const first=processPushOutbox(db,ids,sender);
    await processPushOutbox(db,ids,sender);
    const callsBeforeCompletion=vi.mocked(sendSmsViaTwilio).mock.calls.length;
    release();await first;
    expect(callsBeforeCompletion).toBe(0);expect(sender).toHaveBeenCalledTimes(1);
  });
  it('does not fall back after eligibility changes during a failed provider call',async()=>{
    addDevice('d1');const ids=queue();
    await processPushOutbox(db,ids,async()=>{db.exec('UPDATE firms SET verified=0');throw new Error('provider unavailable');});
    expect(sendSmsViaTwilio).not.toHaveBeenCalled();
  });
  it('waits for retryable devices before falling back from a permanent failure',async()=>{
    addDevice('d1');addDevice('d2');const ids=queue();
    await processPushOutbox(db,ids,async(_platform,token)=>{
      throw new PushProviderError(token.startsWith('d1')?'PUSH_TOKEN_INVALID':'APNS_TIMEOUT',token.startsWith('d1'));
    });
    expect(sendSmsViaTwilio).not.toHaveBeenCalled();
    await processPushOutbox(db,ids,async()=>({providerMessageId:'retry-success'}));
    expect(sendSmsViaTwilio).not.toHaveBeenCalled();
  });
  it('keeps delivered history intact after notifications are disabled',async()=>{
    addDevice('d1');const ids=queue();const sender=vi.fn(async()=>({providerMessageId:'sent'}));
    await processPushOutbox(db,ids,sender);process.env.PUSH_ENABLED='false';
    await processPushOutbox(db,ids,sender);
    expect(sender).toHaveBeenCalledTimes(1);expect(sendSmsViaTwilio).not.toHaveBeenCalled();
    expect(db.prepare('SELECT status,attempt_count FROM push_notification_outbox').get()).toEqual({status:'sent',attempt_count:1});
  });
  it('does not persist arbitrary provider error text',async()=>{
    addDevice('d1');const ids=queue();
    await processPushOutbox(db,ids,async()=>{throw new Error('private-token-value');});
    expect(db.prepare('SELECT last_error FROM push_notification_outbox').get()).toEqual({last_error:'PUSH_PROVIDER_ERROR'});
  });
});
