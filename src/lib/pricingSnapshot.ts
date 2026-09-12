import {calcGrossPrice,calcDurationMinutes,BUFFER_MINUTES,type SpaceType} from './pricing';

// Identifies the existing tariff; changing prices requires a new version.
export const PRICING_VERSION='nitido-existing-tariff-v1';
export function pricingSnapshot(input:{spaceType:SpaceType;sqm:number;expressFeeLei:number;creditLei:number;createdAt?:string}){
 const {spaceType,sqm,expressFeeLei,creditLei}=input;
 if(!['apartament','casa','birou','altul'].includes(spaceType)||!Number.isSafeInteger(sqm)||sqm<=0)throw new Error('Parametri de tarif invalizi');
 const bani=(lei:number)=>{const amount=Math.round(lei*100);if(!Number.isFinite(lei)||lei<0||!Number.isSafeInteger(amount))throw new Error('Sumă invalidă');return amount};
 const service=bani(calcGrossPrice(spaceType,sqm)),extra=bani(expressFeeLei),credit=bani(creditLei);
 const total=service+extra;
 if(!Number.isSafeInteger(total)||credit>total)throw new Error('Credit invalid');
 const createdAt=input.createdAt??new Date().toISOString();
 if(!Number.isFinite(Date.parse(createdAt)))throw new Error('Dată invalidă');
 return {version:PRICING_VERSION,currency:'RON' as const,recordedAt:createdAt,spaceType,sqm,durationMinutes:calcDurationMinutes(sqm),bufferMinutes:BUFFER_MINUTES,lines:[{code:'cleaning',amountBani:service},{code:'express60',amountBani:extra},{code:'platform_credit',amountBani:-credit}],grossBani:total,creditBani:credit,clientTotalBani:total-credit};
}

export const PRICING_SNAPSHOT_LOCK_SQL=`CREATE TRIGGER IF NOT EXISTS jobs_pricing_snapshot_immutable BEFORE UPDATE OF pricing_snapshot ON jobs WHEN OLD.pricing_snapshot IS NOT NULL AND NEW.pricing_snapshot IS NOT OLD.pricing_snapshot BEGIN SELECT RAISE(ABORT, 'Published pricing snapshot is immutable'); END;`;
