import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
const mocks=vi.hoisted(()=>({enabled:vi.fn(()=>true),collect:vi.fn(async()=>{}),deliver:vi.fn()}));
vi.mock('./adminMarketing',()=>({marketingEnabled:mocks.enabled}));
vi.mock('./adminMarketingCity',()=>({processMarketingCollections:mocks.collect}));
vi.mock('./adminMarketingDelivery',()=>({processMarketingDelivery:mocks.deliver}));
import {startMarketingScheduler,requestMarketingDeliveryProcessing} from './adminMarketingScheduler';
const state=globalThis as typeof globalThis & {marketingTimer?:ReturnType<typeof setTimeout>;marketingTick?:boolean;marketingDeliveryTimer?:ReturnType<typeof setTimeout>;marketingDeliveryTick?:boolean;marketingDeliveryWake?:()=>void};
let db:Database.Database;
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-25T10:00:00Z'));mocks.enabled.mockReturnValue(true);mocks.collect.mockReset().mockResolvedValue(undefined);mocks.deliver.mockReset().mockResolvedValue({processed:0,nextDelayMs:15000});vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});db=new Database(':memory:');});
afterEach(()=>{if(state.marketingTimer)clearTimeout(state.marketingTimer);delete state.marketingTimer;delete state.marketingTick;if(state.marketingDeliveryTimer)clearTimeout(state.marketingDeliveryTimer);delete state.marketingDeliveryTimer;delete state.marketingDeliveryTick;delete state.marketingDeliveryWake;db.close();vi.restoreAllMocks();vi.useRealTimers();});
function county(stateValue='collecting',at:string|null=null){
  db.exec('CREATE TABLE marketing_county_jobs(id TEXT PRIMARY KEY,state TEXT,position INTEGER,created_at TEXT,next_attempt_at TEXT);CREATE TABLE marketing_county_dispatch(job_id TEXT PRIMARY KEY,independent INTEGER)');
  db.prepare("INSERT INTO marketing_county_jobs VALUES('CT',?,0,'2026-10-25',?)").run(stateValue,at);
}
describe('serial Marketing scheduler pacing',()=>{
  it('waits for a slow collection to finish, then restarts within one second without overlapping either worker',async()=>{
    county();let finish!:()=>void;let active=0,maxActive=0;
    mocks.collect.mockImplementationOnce(async()=>{active++;maxActive=Math.max(maxActive,active);await new Promise<void>(resolve=>{finish=resolve;});active--;});
    startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(0);await vi.advanceTimersByTimeAsync(45000);expect(mocks.collect).toHaveBeenCalledOnce();expect(mocks.deliver.mock.calls.length).toBeGreaterThan(1);
    finish();await vi.advanceTimersByTimeAsync(0);await vi.advanceTimersByTimeAsync(999);expect(mocks.collect).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(1);expect(mocks.collect).toHaveBeenCalledTimes(2);expect(maxActive).toBe(1);
    expect(console.log).toHaveBeenCalledWith('MKT_COLLECTOR_PACE '+JSON.stringify({durationMs:45000,nextDelayMs:1000}));
  });
  it('uses fifteen-second idle pacing while source deadlines are in the future and leaves those deadlines unchanged',async()=>{
    county('collecting','2026-10-26T10:00:00Z');startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(14999);expect(mocks.collect).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(1);expect(mocks.collect).toHaveBeenCalledTimes(2);expect(db.prepare('SELECT next_attempt_at FROM marketing_county_jobs').get()).toEqual({next_attempt_at:'2026-10-26T10:00:00Z'});
  });
  it('respects a live collector lease and the county plan precedence over legacy discovery work',async()=>{
    county('paused');db.exec("CREATE TABLE marketing_discovery(status TEXT);INSERT INTO marketing_discovery VALUES('pending')");startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(14999);expect(mocks.collect).toHaveBeenCalledOnce();
    db.prepare("UPDATE marketing_county_jobs SET state='collecting'").run();db.exec('CREATE TABLE marketing_collection_lock(until_ms INTEGER)');db.prepare('INSERT INTO marketing_collection_lock VALUES(?)').run(Date.now()+60000);await vi.advanceTimersByTimeAsync(15000);expect(mocks.collect).toHaveBeenCalledTimes(2);
  });
  it('keeps importing counties eligible while one source is preparing, and backs off if only that preparer remains',async()=>{
    county('preparing');db.exec('CREATE TABLE marketing_county_source_lock(until_ms INTEGER)');db.prepare('INSERT INTO marketing_county_source_lock VALUES(?)').run(Date.now()+60000);startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(14999);expect(mocks.collect).toHaveBeenCalledOnce();
    db.exec("INSERT INTO marketing_county_jobs VALUES('B','importing',1,'2026-10-25',NULL);INSERT INTO marketing_county_dispatch VALUES('B',1)");await vi.advanceTimersByTimeAsync(1);expect(mocks.collect).toHaveBeenCalledTimes(2);await vi.advanceTimersByTimeAsync(1000);expect(mocks.collect).toHaveBeenCalledTimes(3);
  });
  it.each(['city','discovery'])('does not miss eligible legacy %s work when no unfinished county plan owns dispatch',async kind=>{
    if(kind==='city')db.exec("CREATE TABLE marketing_city_jobs(state TEXT,next_attempt_at TEXT);INSERT INTO marketing_city_jobs VALUES('waiting',NULL)");else db.exec("CREATE TABLE marketing_discovery(status TEXT);INSERT INTO marketing_discovery VALUES('pending')");
    startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(1000);expect(mocks.collect).toHaveBeenCalledTimes(2);
  });
  it('keeps the collection entry point containing audience maintenance and delivery running every idle tick',async()=>{
    county('review');startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(14999);expect(mocks.collect).toHaveBeenCalledOnce();expect(mocks.deliver).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(1);expect(mocks.collect).toHaveBeenCalledTimes(2);expect(mocks.deliver).toHaveBeenCalledTimes(2);
  });
  it('does not start when disabled or duplicate a scheduler initialized twice, including during an in-flight tick',async()=>{
    mocks.enabled.mockReturnValue(false);startMarketingScheduler(db);expect(vi.getTimerCount()).toBe(0);mocks.enabled.mockReturnValue(true);county();let finish!:()=>void;mocks.collect.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));startMarketingScheduler(db);startMarketingScheduler(db);expect(vi.getTimerCount()).toBe(2);await vi.advanceTimersByTimeAsync(0);startMarketingScheduler(db);expect(mocks.collect).toHaveBeenCalledOnce();finish();await vi.advanceTimersByTimeAsync(1000);expect(mocks.collect).toHaveBeenCalledTimes(2);
  });
  it('backs off after an error and recovers without stopping the scheduler',async()=>{
    county();mocks.collect.mockRejectedValueOnce(Error('fixture'));startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(14999);expect(mocks.collect).toHaveBeenCalledOnce();expect(console.error).toHaveBeenCalledWith('[marketing] worker_failed');await vi.advanceTimersByTimeAsync(1);expect(mocks.collect).toHaveBeenCalledTimes(2);await vi.advanceTimersByTimeAsync(1000);expect(mocks.collect).toHaveBeenCalledTimes(3);
  });
  it('keeps delivery serial while collection continues independently after a failure',async()=>{
    county();mocks.collect.mockRejectedValueOnce(Error('fixture'));let finish!:()=>void;mocks.deliver.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
    startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(45000);expect(mocks.collect.mock.calls.length).toBeGreaterThan(1);expect(mocks.deliver).toHaveBeenCalledOnce();finish();await vi.advanceTimersByTimeAsync(15000);expect(mocks.deliver).toHaveBeenCalledTimes(2);
  });
  it('logs pacing aggregates at most once every five minutes',async()=>{
    startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(299999);expect(console.log).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(1);expect(console.log).toHaveBeenCalledTimes(2);
  });
});

it('runs delivery promptly after a processed batch without eligible collection work',async()=>{mocks.deliver.mockResolvedValue({processed:5,nextDelayMs:1000});startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(1000);expect(mocks.deliver).toHaveBeenCalledTimes(2);expect(mocks.collect).toHaveBeenCalledOnce();});
it('wakes delivery without making the HTTP caller wait for the provider',async()=>{let finish!:()=>void;mocks.deliver.mockImplementationOnce(()=>new Promise(resolve=>{finish=()=>resolve({processed:1,nextDelayMs:1000});}));expect(requestMarketingDeliveryProcessing(db)).toEqual({scheduled:true});await vi.advanceTimersByTimeAsync(0);expect(requestMarketingDeliveryProcessing(db)).toEqual({scheduled:true});expect(mocks.deliver).toHaveBeenCalledOnce();finish();await vi.advanceTimersByTimeAsync(0);expect(mocks.deliver).toHaveBeenCalledTimes(2);});
it('respects a persisted provider backoff instead of spinning',async()=>{mocks.deliver.mockResolvedValue({processed:0,nextDelayMs:60000});startMarketingScheduler(db);await vi.advanceTimersByTimeAsync(59999);expect(mocks.deliver).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(1);expect(mocks.deliver).toHaveBeenCalledTimes(2);});
