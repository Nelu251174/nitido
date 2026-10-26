import {CLEANING_SCOPE,type AutomaticCleaningType} from './cleaningTypes';
import {bookingTerms} from './bookingTerms';
import {calcGrossPrice,calcWindowsPrice,calcBathroomPrice,calcServiceDuration,PRICING_VERSION,BUFFER_MINUTES,type SpaceType} from './pricing';
import {configuredServiceMarket} from './serviceMarkets';

// Identifies the existing tariff; changing prices requires a new version.
export {PRICING_VERSION} from './pricing';
export function pricingSnapshot(input:{spaceType:SpaceType;sqm:number;cleaningType?:AutomaticCleaningType;windowsSqm?:number;bathroomCount?:number;expressFeeLei:number;creditLei:number;createdAt?:string;countryCode?:unknown;currency?:unknown;inclusions?:readonly {key:string;label:string}[]}){
 const market=configuredServiceMarket(input);
 const {spaceType,sqm,expressFeeLei,creditLei}=input;
 if(!['apartament','casa','birou','altul'].includes(spaceType)||!Number.isSafeInteger(sqm)||sqm<=0)throw new Error('Parametri de tarif invalizi');
 const bani=(lei:number)=>{const amount=Math.round(lei*100);if(!Number.isFinite(lei)||lei<0||!Number.isSafeInteger(amount))throw new Error('Sumă invalidă');return amount};
 const service=bani(calcGrossPrice(spaceType,sqm,input.cleaningType)),extra=bani(expressFeeLei),credit=bani(creditLei);
 const windowsSqm=input.windowsSqm??0,windows=bani(calcWindowsPrice(windowsSqm));
 const bathrooms=bani(calcBathroomPrice(input.bathroomCount??1));
 const total=service+windows+bathrooms+extra;
 if(!Number.isSafeInteger(total)||credit>total)throw new Error('Credit invalid');
 const createdAt=input.createdAt??new Date().toISOString();
 if(!Number.isFinite(Date.parse(createdAt)))throw new Error('Dată invalidă');
 return {bookingTerms:bookingTerms({durationMinutes:calcServiceDuration(sqm,windowsSqm),bufferMinutes:BUFFER_MINUTES,grossLei:total/100,creditLei:credit/100,bathroomCount:input.bathroomCount,inclusions:input.inclusions??(input.cleaningType?CLEANING_SCOPE[input.cleaningType]:undefined),cleaningType:input.cleaningType}),version:PRICING_VERSION,cleaningType:input.cleaningType??'general',...market,recordedAt:createdAt,spaceType,sqm,windowsSqm,bathroomCount:input.bathroomCount??null,durationMinutes:calcServiceDuration(sqm,windowsSqm),bufferMinutes:BUFFER_MINUTES,lines:[{code:'cleaning',amountBani:service},...(bathrooms>0?[{code:'additional_bathrooms',amountBani:bathrooms}]:[]),...(windows>0?[{code:'windows',amountBani:windows}]:[]),{code:'express60',amountBani:extra},{code:'platform_credit',amountBani:-credit}],grossBani:total,creditBani:credit,clientTotalBani:total-credit};
}

export const PRICING_SNAPSHOT_LOCK_SQL=`CREATE TRIGGER IF NOT EXISTS jobs_pricing_snapshot_immutable BEFORE UPDATE OF pricing_snapshot ON jobs WHEN OLD.pricing_snapshot IS NOT NULL AND NEW.pricing_snapshot IS NOT OLD.pricing_snapshot BEGIN SELECT RAISE(ABORT, 'Published pricing snapshot is immutable'); END;`;
