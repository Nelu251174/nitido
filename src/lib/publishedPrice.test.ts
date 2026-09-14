import {describe,it,expect} from 'vitest';
import {pricingSnapshot} from './pricingSnapshot';
import {readPublishedPrice} from './publishedPrice';
const valid=()=>pricingSnapshot({spaceType:'apartament',sqm:120,expressFeeLei:100,creditLei:20});
describe('published price presentation',()=>{
 it('reads stored values without recalculating them using current tariffs',()=>{const p=valid();p.lines[0].amountBani=70000;p.grossBani=80000;p.clientTotalBani=78000;expect(readPublishedPrice(JSON.stringify(p))?.grossBani).toBe(80000)});
 it('does not invent a record for old or malformed reservations',()=>{for(const value of [null,undefined,'bad','{}','null'])expect(readPublishedPrice(value)).toBeNull()});
 it('rejects inconsistent totals, wrong currency and fractional bani',()=>{for(const patch of [{currency:'EUR'},{clientTotalBani:1},{creditBani:.5},{recordedAt:'bad'}])expect(readPublishedPrice(JSON.stringify({...valid(),...patch}))).toBeNull()});
 it('rejects duplicate or unknown charge lines',()=>{const p=valid();p.lines[1].code='cleaning';expect(readPublishedPrice(JSON.stringify(p))).toBeNull()});
});
