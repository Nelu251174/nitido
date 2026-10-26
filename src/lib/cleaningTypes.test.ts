import {describe,it,expect} from 'vitest';
import {calcGrossPrice,calcServicePrice} from './pricing';
import {pricingSnapshot} from './pricingSnapshot';
import {readPublishedPrice} from './publishedPrice';
import {CLEANING_SCOPE,cleaningAssessmentUrl} from './cleaningTypes';
describe('distinct cleaning tariffs',()=>{
 it.each([[40,400],[41,550],[60,550],[61,700],[80,700],[81,850],[100,850],[101,859],[120,1020]])('maintenance %i m² costs %i lei',(sqm,price)=>expect(calcGrossPrice('apartament',sqm,'maintenance')).toBe(price));
 it.each([['casa',8,400],['birou',6,300],['altul',7,350]] as const)('applies the %s maintenance rate and minimum',(space,rate,min)=>{expect(calcGrossPrice(space,100,'maintenance')).toBe(rate*100);expect(calcGrossPrice(space,1,'maintenance')).toBe(min)});
 it('adds unchanged window and bathroom supplements once for either package',()=>{expect(calcServicePrice('apartament',60,10,2,'maintenance')).toBe(770);expect(calcServicePrice('apartament',60,10,2,'general')).toBe(1220)});
 it.each(['renovation','bogus',null])('never guesses an automatic amount for %s',type=>expect(()=>calcGrossPrice('apartament',60,type as never)).toThrow());
 it('freezes type, price and included scope in the published snapshot',()=>{const s=pricingSnapshot({spaceType:'apartament',sqm:60,cleaningType:'maintenance',bathroomCount:1,expressFeeLei:0,creditLei:0});expect(s.cleaningType).toBe('maintenance');expect(s.grossBani).toBe(55000);expect(s.bookingTerms.cleaningType).toBe('maintenance');expect(s.bookingTerms.inclusions).toEqual(CLEANING_SCOPE.maintenance);expect(readPublishedPrice(JSON.stringify(s))).toEqual(JSON.parse(JSON.stringify(s)))});
 it('opens the renovation assessment with safely encoded city and surface',()=>{const u=new URL(cleaningAssessmentUrl('Iași & zona',60),'https://nitido.ro');expect(u.searchParams.get('category')).toBe('renovation');expect(u.searchParams.get('city')).toBe('Iași & zona')});
});
