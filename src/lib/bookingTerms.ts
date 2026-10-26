import {AUTHORIZATION_POLICY_VERSION,CONFIRMATION_WINDOW_HOURS} from './authorizationPolicy';
import {CREDIT_POLICY_VERSION} from './referral';
import {PLATFORM_COMMISSION,PRICING_VERSION,MIN_CLEANING_DURATION_MINUTES,calcNetForFirm,EXTRA_BATHROOM_FEE_LEI} from './pricing';
import type {CleaningType} from './cleaningTypes';
import {CHECKLIST} from './workspaceShared';

export const BOOKING_TERMS_VERSION='nitido-booking-terms-2026-10-26-v5';
export const BOOKING_DURATION_NOTICE='Pentru rezervările noi: minimum 3 ore programate la locație pentru echipă, nu ore-om împărțite între persoane. Bufferul și deplasarea sunt separate. Prețul rămâne pe pachet, nu pe oră; nu se adaugă taxe pentru ore fictive sau așteptare forțată.';
export const BOOKING_TEAM_NOTICE='Firma de curățenie care acceptă lucrarea decide câte persoane trimite și își organizează personalul și costurile. Prețul afișat clientului nu se modifică în funcție de numărul de persoane trimise.';

/** New records only. Existing immutable snapshots and accepted timing are never rewritten. */
export function bookingTerms(input:{durationMinutes:number;bufferMinutes:number;grossLei:number;creditLei:number;bathroomCount?:number;cleaningType?:CleaningType;inclusions?:readonly {key:string;label:string}[];team?:{id:string;name:string}|null}){
 const firmBani=Math.round(calcNetForFirm(input.grossLei)*100),quotedClientBani=Math.round((input.grossLei-input.creditLei)*100);
 return {
  version:BOOKING_TERMS_VERSION,tariffVersion:PRICING_VERSION,...(input.cleaningType?{cleaningType:input.cleaningType}:{}),
  duration:{scheduledMinutes:input.durationMinutes,minimumOnsiteMinutes:MIN_CLEANING_DURATION_MINUTES,unit:'team_onsite_minutes',actualWorkedMinutes:null,bufferMinutes:input.bufferMinutes},
  team:{id:input.team?.id??null,name:input.team?.name??null,headcount:null,responsibility:'provider',status:input.team?'provider_assigned':'provider_managed'},
  inclusions:(input.inclusions??CHECKLIST).map(x=>({...x})),
  bathrooms:input.bathroomCount===undefined?null:{count:input.bathroomCount,includedCount:1,additionalCount:Math.max(0,input.bathroomCount-1),additionalUnitPriceLei:EXTRA_BATHROOM_FEE_LEI,additionalScope:'sanitary_fixtures_bath_shower_taps_mirrors',floorIncludedInArea:true},
  includedKitchens:input.bathroomCount===undefined?null:1,
  unconfirmedDetails:[...(input.bathroomCount===undefined?['bathroom_count']:[]),'materials','transport_tax_breakdown'],
  commission:{rate:PLATFORM_COMMISSION,basis:'gross_before_platform_credit',firmAmountBani:firmBani,firmRounding:'Math.round(grossLei * (1-rate)) in whole lei',vatBreakdown:null,processingCostBani:null},
  settlement:{quotedClientBani,existingPaymentFloorBani:firmBani,reconciliationRequired:quotedClientBani<firmBani},
  conditions:{authorizationPolicy:AUTHORIZATION_POLICY_VERSION,confirmationWindowHours:CONFIRMATION_WINDOW_HOURS,creditPolicy:CREDIT_POLICY_VERSION,billingBasis:'fixed_package',hold:'valid_acceptance',capture:'valid_completion',earlyCompletion:'No fictional hours, forced waiting or added time charge; further commercial policy requires owner approval'},
 } as const;
}
