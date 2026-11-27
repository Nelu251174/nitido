import type { Database } from 'better-sqlite3';
import { marketingEnabled } from './adminMarketing';
import { startMarketingCollectionScheduler } from './adminMarketingCollector';
import { startMarketingCollectorProcess } from './adminMarketingCollectorProcess';
import { processMarketingDelivery } from './adminMarketingDelivery';
const state=globalThis as typeof globalThis & {marketingTimer?:ReturnType<typeof setTimeout>;marketingTick?:boolean;marketingDeliveryTimer?:ReturnType<typeof setTimeout>;marketingDeliveryTick?:boolean;marketingDeliveryWake?:()=>void};
const FAST_MS=1000,IDLE_MS=15000;

/** Keep public collection work outside the production HTTP event loop. */
export function startMarketingScheduler(db:Database) {
  if(!marketingEnabled())return;
  startMarketingDeliveryScheduler(db);
  if(process.env.NODE_ENV==='production')startMarketingCollectorProcess(db.name);
  else startMarketingCollectionScheduler(db);
}

function startMarketingDeliveryScheduler(db:Database){
 if(state.marketingDeliveryWake)return;
 let requested=false;
 const schedule=(delay:number)=>{state.marketingDeliveryTimer=setTimeout(()=>void tick(),delay);state.marketingDeliveryTimer.unref();};
 const tick=async()=>{
  if(state.marketingDeliveryTick)return;
  state.marketingDeliveryTick=true;let delay=IDLE_MS;
  try{const result=await processMarketingDelivery(db);delay=result.nextDelayMs??(result.processed?FAST_MS:IDLE_MS);}
  catch{console.error('[marketing] delivery_worker_failed');}
  finally{state.marketingDeliveryTick=false;const next=requested?0:delay;requested=false;schedule(next);}
 };
 state.marketingDeliveryWake=()=>{
  if(state.marketingDeliveryTick){requested=true;return;}
  if(state.marketingDeliveryTimer)clearTimeout(state.marketingDeliveryTimer);
  schedule(0);
 };
 schedule(0);
}

/** Wake the existing serial worker; HTTP requests never wait for provider network calls. */
export function requestMarketingDeliveryProcessing(db:Database){
 if(!marketingEnabled())return {scheduled:false};
 startMarketingDeliveryScheduler(db);state.marketingDeliveryWake?.();return {scheduled:true};
}
