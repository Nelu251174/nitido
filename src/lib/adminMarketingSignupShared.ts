import type {MarketingCategory} from './adminMarketingShared';
export const MARKETING_SIGNUP_CONSENT_VERSION='2026-10-25-v1';
export const MARKETING_SIGNUP_CONSENT='Vreau să primesc prin email noutăți și oferte NITIDO. Mă pot dezabona oricând.';
export const MARKETING_SIGNUP_STATES={pending:'Așteaptă confirmarea adresei',confirmed:'Adresă confirmată',withdrawn:'Acord retras'} as const;
export interface MarketingSignupRow{id:string;name:string;email:string;category:MarketingCategory;county_code:string;city:string;state:keyof typeof MARKETING_SIGNUP_STATES;requested_at:string;confirmed_at:string|null;contact_id:string|null;review_required:string;consent_version:string;consent_text:string;version:number;}
export interface MarketingSignupView{items:MarketingSignupRow[];total:number;page:number;pages:number;counts:{pending:number;confirmed:number;withdrawn:number};}
