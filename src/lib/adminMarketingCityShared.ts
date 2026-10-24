import type { MarketingCategory } from './adminMarketingShared';
export const CITY_COLLECTION_STATES = {queued:'În așteptare',discovering:'Se caută firmele din municipiu',collecting:'Se verifică firmele și site-urile',waiting:'Așteaptă reluarea sursei',paused:'În pauză',completed:'Colectare finalizată',canceled:'Colectare anulată'} as const;
export interface MarketingCityJob {
 id:string;city:string;state:keyof typeof CITY_COLLECTION_STATES;total:number;processed:number;emails:number;saved:number;duplicates:number;withoutEmail:number;errors:number;createdAt:string;updatedAt:string;message:string;nextAttemptAt:string|null;
}
export interface MarketingCityItem {id:string;name:string;category:MarketingCategory;email:string;website:string;source:string;status:string;warning:string;contactId:string|null;}
export interface MarketingCityView {job:MarketingCityJob;items:MarketingCityItem[];page:number;pages:number;attribution:string;}
