import {describe,it,expect} from 'vitest';
import {calcServicePrice,calcGrossPrice,calcServiceDuration,validWindowsSqm} from './pricing';
import {pricingSnapshot} from './pricingSnapshot';
import {readPublishedPrice} from './publishedPrice';
describe('separate window service',()=>{
 it('adds 10m² glass once, keeps two faces in the same tariff',()=>{expect(calcGrossPrice('apartament',60)).toBe(450);expect(calcServicePrice('apartament',60,10)).toBe(530);expect(calcServicePrice('apartament',60,0)).toBe(450);expect(calcServiceDuration(60,10)).toBe(150);});
 it('enforces intervention minimums for small non-apartment spaces',()=>{expect(calcGrossPrice('casa',10)).toBe(350);expect(calcGrossPrice('birou',10)).toBe(250);expect(calcGrossPrice('altul',10)).toBe(300);});
 it('rejects negative, fractional, excessive, string and nonfinite glass areas',()=>{for(const value of [-1,1.5,201,'10',NaN,Infinity,null])expect(validWindowsSqm(value)).toBe(false);});
 it('separates cleaning, windows, Express and credit without changing the total',()=>{const p=pricingSnapshot({spaceType:'apartament',sqm:60,windowsSqm:10,expressFeeLei:79,creditLei:20});expect(p.grossBani).toBe(60900);expect(p.clientTotalBani).toBe(58900);expect(p.lines.map(l=>l.amountBani)).toEqual([45000,8000,7900,-2000]);expect(readPublishedPrice(JSON.stringify(p))).not.toBeNull();});
 it('still reads old published tariffs verbatim',()=>{const old={currency:'RON',recordedAt:'2026-09-01T00:00:00Z',grossBani:40000,creditBani:0,clientTotalBani:40000,lines:[{code:'cleaning',amountBani:40000},{code:'express60',amountBani:0},{code:'platform_credit',amountBani:0}]};expect(readPublishedPrice(JSON.stringify(old))?.clientTotalBani).toBe(40000);});
});
