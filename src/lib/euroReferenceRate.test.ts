import {describe,it,expect,vi,afterEach} from 'vitest';
import {parseEuroReferenceRate,getEuroReferenceRate,EURO_RATE_URL} from './euroReferenceRate';
const now=Date.parse('2026-10-29T10:00:00Z'),xml=(date='2026-10-29',rate='5.1234')=>`<DataSet><Body><OrigCurrency>RON</OrigCurrency><Cube date="${date}"><Rate currency="USD">4.4</Rate><Rate currency="EUR">${rate}</Rate></Cube></Body></DataSet>`;
afterEach(()=>vi.unstubAllGlobals());
describe('central-bank display rate validation',()=>{
 it('uses the EUR rate and its publication date',()=>expect(parseEuroReferenceRate(xml(),now)).toEqual({eurRon:5.1234,date:'2026-10-29'}));
 it.each([xml('2026-01-01'),xml('2027-01-01'),xml('2026-02-31'),xml('2026-10-29','0'),xml('2026-10-29','100'),xml().replace('RON','USD'),xml().replace('EUR','XXX'),'<!DOCTYPE test>'+xml(),'x'.repeat(100001)])('rejects invalid, future, expired or unsafe feed',feed=>expect(()=>parseEuroReferenceRate(feed,now)).toThrow());
 it('falls back transparently on fetch failure',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('unavailable')));expect(await getEuroReferenceRate()).toBeNull();});
 it('does not send any visitor information to the bank',async()=>{const fetch=vi.fn().mockResolvedValue(new Response(xml(new Date().toISOString().slice(0,10)))) ;vi.stubGlobal('fetch',fetch);expect(await getEuroReferenceRate()).toMatchObject({eurRon:5.1234});expect(fetch.mock.calls[0][0]).toBe(EURO_RATE_URL);expect(fetch.mock.calls[0][1].headers).toEqual({Accept:'application/xml,text/xml'});});
});
