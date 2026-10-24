import type { Database } from 'better-sqlite3';
import { marketingEnabled } from './adminMarketing';
import { processMarketingDiscovery } from './adminMarketingDiscovery';
import { processMarketingDelivery } from './adminMarketingDelivery';
const state=globalThis as typeof globalThis & {marketingTimer?:ReturnType<typeof setInterval>;marketingTick?:boolean};
export function startMarketingScheduler(db:Database) {
  if(!marketingEnabled() || state.marketingTimer)return;
  const tick=async()=>{if(state.marketingTick)return;state.marketingTick=true;try {await Promise.all([processMarketingDiscovery(db),processMarketingDelivery(db)]);}catch{console.error('[marketing] worker_failed');}finally{state.marketingTick=false;}};
  state.marketingTimer=setInterval(()=>void tick(),15000);state.marketingTimer.unref();
}
