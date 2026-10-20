import {CREDIT_POLICY_VERSION} from './referral';
import {PLATFORM_COMMISSION,PRICING_VERSION,MIN_CLEANING_DURATION_MINUTES,calcNetForFirm} from './pricing';
import {CHECKLIST} from './workspaceShared';

export const BOOKING_TERMS_VERSION='nitido-booking-terms-2026-10-20-v1';
export const BOOKING_DURATION_NOTICE='Pentru rezervările noi: minimum 3 ore programate la locație pentru echipă, nu ore-om împărțite între persoane. Bufferul și deplasarea sunt separate. Prețul rămâne pe pachet, nu pe oră; nu se adaugă taxe pentru ore fictive sau așteptare forțată.';
export const BOOKING_TEAM_NOTICE='Numărul de persoane nu este stabilit de calculator. Echipa și operațiunile se verifică cu firma înainte de acceptare; o estimare nu confirmă disponibilitatea unei echipe.';

/** New records only. Existing immutable snapshots and accepted timing are never rewritten. */
export function bookingTerms(input:{durationMinutes:number;bufferMinutes:number;grossLei:number;creditLei:number;inclusions?:readonly {key:string;label:string}[];team?:{id:string;name:string}|null}){
 const firmBani=Math.round(calcNetForFirm(input.grossLei)*100),quotedClientBani=Math.round((input.grossLei-input.creditLei)*100);
 return {
  version:BOOKING_TERMS_VERSION,tariffVersion:PRICING_VERSION,
  duration:{scheduledMinutes:input.durationMinutes,minimumOnsiteMinutes:MIN_CLEANING_DURATION_MINUTES,unit:'team_onsite_minutes',actualWorkedMinutes:null,bufferMinutes:input.bufferMinutes},
  team:input.team?{id:input.team.id,name:input.team.name,headcount:null,status:'planned_headcount_not_recorded'}:{id:null,name:null,headcount:null,status:'not_confirmed'},
  inclusions:(input.inclusions??CHECKLIST).map(x=>({...x})),
  unconfirmedDetails:['bathroom_count','materials','transport_tax_breakdown','team_headcount'],
  commission:{rate:PLATFORM_COMMISSION,basis:'gross_before_platform_credit',firmAmountBani:firmBani,firmRounding:'Math.round(grossLei * (1-rate)) in whole lei',vatBreakdown:null,processingCostBani:null},
  settlement:{quotedClientBani,existingPaymentFloorBani:firmBani,reconciliationRequired:quotedClientBani<firmBani},
  conditions:{creditPolicy:CREDIT_POLICY_VERSION,billingBasis:'fixed_package',hold:'valid_acceptance',capture:'valid_completion',earlyCompletion:'No fictional hours, forced waiting or added time charge; further commercial policy requires owner approval'},
 } as const;
}
