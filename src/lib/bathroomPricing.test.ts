import {describe,it,expect} from 'vitest';
import {calcBathroomPrice,calcServicePrice,validBathroomCount,calcNetForFirm} from './pricing';
import {pricingSnapshot} from './pricingSnapshot';
import {readPublishedPrice} from './publishedPrice';
describe('approved bathroom package',()=>{
 it.each([[0,0],[1,0],[2,100],[3,200],[20,1900]])('prices %i bathrooms with %i lei extra', (count,extra)=>{expect(calcBathroomPrice(count)).toBe(extra);expect(calcServicePrice('apartament',60,0,count)).toBe(1000+extra)});
 it.each([undefined,null,'2',-1,1.5,21,NaN,Infinity])('rejects invalid quantity %s',value=>expect(validBathroomCount(value)).toBe(false));
 it('combines bathrooms and windows exactly once with unchanged commission',()=>{expect(calcServicePrice('apartament',60,10,2)).toBe(1220);expect(calcNetForFirm(500)).toBe(410)});
 it('freezes the scope, line items, net, credit and final customer amount',()=>{const p=pricingSnapshot({spaceType:'apartament',sqm:60,bathroomCount:2,windowsSqm:10,expressFeeLei:0,creditLei:20});expect(p).toMatchObject({bathroomCount:2,grossBani:122000,creditBani:2000,clientTotalBani:120000,bookingTerms:{bathrooms:{count:2,additionalCount:1,additionalUnitPriceLei:100,floorIncludedInArea:true},includedKitchens:1,commission:{rate:0.18}}});expect(p.bookingTerms.unconfirmedDetails).not.toContain('bathroom_count');expect(p.lines.map(x=>[x.code,x.amountBani])).toEqual([['cleaning',100000],['additional_bathrooms',10000],['windows',12000],['express60',0],['platform_credit',-2000]]);expect(readPublishedPrice(JSON.stringify(p))).toEqual(p);const forged=structuredClone(p);forged.lines.push({code:'additional_bathrooms',amountBani:5000});expect(readPublishedPrice(JSON.stringify(forged))).toBeNull()});
 it('does not invent bathroom counts or surcharges for legacy templates',()=>{const p=pricingSnapshot({spaceType:'apartament',sqm:60,expressFeeLei:0,creditLei:0});expect(p.grossBani).toBe(100000);expect(p.bathroomCount).toBeNull();expect(p.bookingTerms.bathrooms).toBeNull();expect(p.bookingTerms.unconfirmedDetails).toContain('bathroom_count')});
});
