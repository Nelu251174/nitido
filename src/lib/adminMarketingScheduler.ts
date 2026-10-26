import type { Database } from 'better-sqlite3';
import { marketingEnabled } from './adminMarketing';
import { processMarketingCollections } from './adminMarketingCity';
import { processMarketingDelivery } from './adminMarketingDelivery';
const state=globalThis as typeof globalThis & {marketingTimer?:ReturnType<typeof setTimeout>;marketingTick?:boolean};
const FAST_MS=1000,IDLE_MS=15000;

/** Read eligibility only; source readers continue to enforce their persisted host deadlines. */
function hasEligibleWork(db:Database){
  const exists=(name:string)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const at=new Date().toISOString(),ms=Date.now();
  if(exists('marketing_collection_lock')&&db.prepare('SELECT 1 FROM marketing_collection_lock WHERE until_ms>?').get(ms))return false;
  if(exists('marketing_county_jobs')){
    const first=db.prepare("SELECT id FROM marketing_county_jobs WHERE state<>'completed' ORDER BY position,created_at LIMIT 1").get() as {id:string}|undefined;
    if(first){
      // A county plan owns dispatch even when all its counties are waiting. Do not spin on legacy work behind it.
      if(!exists('marketing_county_dispatch'))return false;
      const preparing=exists('marketing_county_source_lock')&&!!db.prepare('SELECT 1 FROM marketing_county_source_lock WHERE until_ms>?').get(ms);
      return !!db.prepare(`SELECT 1 FROM marketing_county_jobs j LEFT JOIN marketing_county_dispatch d ON d.job_id=j.id WHERE
        (j.id=? OR d.independent=1) AND j.state NOT IN ('completed','paused','review') AND (j.next_attempt_at IS NULL OR j.next_attempt_at<=?)
        AND (?=0 OR j.state NOT IN ('queued','preparing')) LIMIT 1`).get(first.id,at,preparing?1:0);
    }
  }
  if(exists('marketing_city_jobs')&&db.prepare("SELECT 1 FROM marketing_city_jobs WHERE state IN ('queued','discovering','collecting','waiting') AND (next_attempt_at IS NULL OR next_attempt_at<=?) LIMIT 1").get(at))return true;
  // Audience maintenance and delivery still run on the existing entry points at least every idle tick.
  return exists('marketing_discovery')&&!!db.prepare("SELECT 1 FROM marketing_discovery WHERE status='pending' LIMIT 1").get();
}
export function startMarketingScheduler(db:Database) {
  if(!marketingEnabled() || state.marketingTimer)return;
  let loggedAt:number|undefined;
  const schedule=(delay:number)=>{state.marketingTimer=setTimeout(()=>void tick(),delay);state.marketingTimer.unref();};
  const tick=async()=>{
    if(state.marketingTick){schedule(IDLE_MS);return;}
    state.marketingTick=true;const started=Date.now();let nextDelayMs=IDLE_MS;
    try{
      // Keep the guard until both workers settle, including when one rejects before the other finishes.
      const results=await Promise.allSettled([processMarketingCollections(db),processMarketingDelivery(db)]);
      if(results.some(result=>result.status==='rejected'))throw Error('MARKETING_TICK_FAILED');
      if(hasEligibleWork(db))nextDelayMs=FAST_MS;
    }catch{console.error('[marketing] worker_failed');}
    finally{
      state.marketingTick=false;
      if(loggedAt===undefined||Date.now()-loggedAt>=5*60000){loggedAt=Date.now();console.log('MKT_COLLECTOR_PACE '+JSON.stringify({durationMs:Math.max(0,Date.now()-started),nextDelayMs}));}
      schedule(nextDelayMs);
    }
  };
  schedule(0);
}
