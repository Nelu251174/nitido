import {describe,it,expect} from 'vitest';
import {calculateInternationalCost,internationalCostExample,INTERNATIONAL_MARKETS,validateInternationalCostInput} from './adminInternationalCosts';
import {configuredServiceMarket,EU_COUNTRIES} from './serviceMarkets';
describe('international cost planning, disconnected from booking',()=>{
 it('covers only the existing 26 foreign markets with local planning currencies',()=>{
  expect(INTERNATIONAL_MARKETS.map(m=>m.code).sort()).toEqual(EU_COUNTRIES.filter(c=>c!=='RO').sort());
  expect(INTERNATIONAL_MARKETS.find(m=>m.code==='CZ')?.currency).toBe('CZK');
  expect(INTERNATIONAL_MARKETS.find(m=>m.code==='DK')?.currency).toBe('DKK');
 });
 it('preserves the Romanian booking contract and blocks foreign booking activation',()=>{
  expect(configuredServiceMarket()).toEqual({countryCode:'RO',currency:'RON'});
  expect(configuredServiceMarket({countryCode:'RO',currency:'RON'})).toEqual({countryCode:'RO',currency:'RON'});
  expect(()=>configuredServiceMarket({countryCode:'AT'})).toThrow(/după configurarea tarifelor/);
  expect(()=>validateInternationalCostInput({...internationalCostExample(),countryCode:'RO',currency:'RON'})).toThrow(/România/);
 });
 it('calculates the illustrative 53 EUR worker-hour and keeps it non-executable',()=>{
  const r=calculateInternationalCost(internationalCostExample(),'2026-11-01');
  expect(r).toMatchObject({netWorkerHourMinor:5300,netTotalMinor:15900,vatMinor:3180,grossTotalMinor:19080,status:'draft',executable:false});
  expect(r.totalCostMinor).toBe(11780);expect(r.netFloorMinor).toBe(15707);
 });
 it('two people for three hours are six worker-hours; shared travel is charged once',()=>{
  const d=internationalCostExample(),one=calculateInternationalCost(d),two=calculateInternationalCost({...d,workers:2});
  expect(two.personMinutes).toBe(360);expect(two.fixedCostsMinor).toBe(one.fixedCostsMinor);
  expect(two.payrollCostMinor).toBe(one.payrollCostMinor*2);
  expect(two.hourlyCostsMinor).toBe(one.hourlyCostsMinor*2);
  expect(two.totalCostMinor).toBe(one.totalCostMinor*2-one.fixedCostsMinor);
 });
 it('enforces the higher of NITIDO and supplier time minimums',()=>{
  expect(calculateInternationalCost({...internationalCostExample(),onsiteMinutes:60}).onsiteMinutes).toBe(180);
  expect(calculateInternationalCost({...internationalCostExample(),supplierMinimumMinutes:360}).onsiteMinutes).toBe(360);
 });
 it('preserves a larger visit minimum without pretending it is the worker-hour price',()=>{
  const r=calculateInternationalCost({...internationalCostExample(),supplierMinimumNetMinor:20000});
  expect(r).toMatchObject({netTotalMinor:20000,netWorkerHourMinor:5300,grossTotalMinor:24000,supplierMinimumApplied:true});
 });
 it('does not invent VAT or actual settlement support',()=>{
  const r=calculateInternationalCost({...internationalCostExample(),vatBps:null});
  expect(r.grossTotalMinor).toBeNull();expect(r.vatMinor).toBeNull();
  expect(r.blockers).toContain('Monedă de încasare și procesare');expect(r.blockers).toContain('Cota TVA este neconfirmată');
 });
 it('annual complete payroll is not loaded twice with holidays or a new tax coefficient',()=>{
  const r=calculateInternationalCost({...internationalCostExample(),annualEmployerCostMinor:3900000,annualBillableMinutes:90000});
  expect(r.payrollCostMinor).toBe(7800);
 });
 it('fewer billed annual hours raise the necessary price',()=>{
  const d=internationalCostExample();expect(calculateInternationalCost({...d,annualBillableMinutes:30000}).netFloorMinor).toBeGreaterThan(calculateInternationalCost(d).netFloorMinor);
 });
 it('language and connection-country values cannot change the job-country calculation',()=>{
  const d=internationalCostExample(),r=calculateInternationalCost(d);
  expect(calculateInternationalCost({...d,locale:'fr',connectionCountry:'US',ip:'not used'})).toEqual(r);
 });
 it('rejects invalid units, currency mismatches, missing city and non-finite values',()=>{
  for(const patch of [{currency:'USD'},{countryCode:'US'},{city:''},{annualEmployerCostMinor:Number.NaN},{annualBillableMinutes:0},{workers:1.5},{materialsHourlyMinor:-1},{basis:'net_wage'},{sourceUrls:['http://example.com']},{sourceUrls:['https://name:secret@example.com']}])expect(()=>validateInternationalCostInput({...internationalCostExample(),...patch})).toThrow();
 });
 it('rejects impossible commissions and margin totals',()=>{
  expect(()=>calculateInternationalCost({...internationalCostExample(),platformAndProcessingBps:9000,operatingMarginBps:1500})).toThrow(/mai puțin de 100/);
 });
 it('uses a margin on sales rather than a markup on costs',()=>{
  const r=calculateInternationalCost({...internationalCostExample(),platformAndProcessingBps:0,operatingMarginBps:2000,roundingMinor:1});
  expect(r.netFloorMinor).toBe(14725);expect(r.operatingMarginBps).toBeGreaterThanOrEqual(2000);
 });
 it('retains the desired margin after conservative minor-unit rounding',()=>{
  for(const minutes of [181,197,250,360])for(const workers of [1,2,5]){
   const r=calculateInternationalCost({...internationalCostExample(),onsiteMinutes:minutes,workers,roundingMinor:1});
   expect(r.operatingMarginBps).toBeGreaterThanOrEqual(1500);
  }
 });
 it('refuses overflowing output amounts instead of returning imprecise currency numbers',()=>{
  expect(()=>calculateInternationalCost({...internationalCostExample(),annualEmployerCostMinor:1e12,annualBillableMinutes:60,workers:100,onsiteMinutes:1440,platformAndProcessingBps:9999,operatingMarginBps:0})).toThrow(/limita/);
 });
 it('an illustrative example cannot claim commercial evidence is verified',()=>{
  const d=internationalCostExample();expect(()=>validateInternationalCostInput({...d,evidence:{...d.evidence,payroll:true}})).toThrow(/ilustrativ/);
 });
 it('even all declared evidence never activates or publishes an international tariff',()=>{
  const d=internationalCostExample(),r=calculateInternationalCost({...d,basis:'supplier_costs',validUntil:'2026-12-31',supplierMinimumNetMinor:0,evidence:Object.fromEntries(Object.keys(d.evidence).map(k=>[k,true]))},'2026-11-01');
  expect(r.blockers).toEqual(['Publicarea internațională nu este disponibilă în acest registru.']);expect(r.executable).toBe(false);
 });
 it('does not treat expired or impossible dates as valid offers',()=>{
  expect(calculateInternationalCost({...internationalCostExample(),validUntil:'2026-10-31'},'2026-11-01').blockers).toContain('Oferta este expirată');
  expect(()=>calculateInternationalCost({...internationalCostExample(),validUntil:'2026-02-30'})).toThrow(/Data/);
 });
});
