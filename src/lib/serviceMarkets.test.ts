import {describe,it,expect} from 'vitest';
import {EU_COUNTRIES,serviceCountry,serviceCurrency,configuredServiceMarket} from './serviceMarkets';
import {pricingSnapshot} from './pricingSnapshot';

describe('owner-approved EU billing policy',()=>{
  it('uses RON for Romania and EUR for all 26 other EU countries, including non-eurozone countries',()=>{
    expect(new Set(EU_COUNTRIES).size).toBe(27);
    for(const country of EU_COUNTRIES)expect(serviceCurrency(country)).toBe(country==='RO'?'RON':'EUR');
  });
  it('rejects countries outside the approved scope and malformed values',()=>{
    expect(serviceCountry(' fr ')).toBe('FR');
    for(const value of ['GB','US','../../FR','',null,24])expect(()=>serviceCountry(value)).toThrow();
  });
  it('keeps the historical Romanian contract and rejects a currency supplied by the client',()=>{
    expect(configuredServiceMarket()).toEqual({countryCode:'RO',currency:'RON'});
    expect(()=>configuredServiceMarket({countryCode:'RO',currency:'EUR'})).toThrow(/Moneda/);
  });
  it('does not relabel Romanian tariffs in euros or quote unconfigured foreign coverage',()=>{
    for(const country of EU_COUNTRIES.filter(code=>code!=='RO')){
      try{configuredServiceMarket({countryCode:country,currency:'EUR'});throw Error('Unexpected foreign quote');}
      catch(error){expect(error).toMatchObject({status:422,countryCode:country,currency:'EUR'});}
      expect(()=>pricingSnapshot({spaceType:'apartament',sqm:80,expressFeeLei:0,creditLei:0,countryCode:country})).toThrow();
    }
    expect(pricingSnapshot({spaceType:'apartament',sqm:80,expressFeeLei:0,creditLei:0})).toMatchObject({countryCode:'RO',currency:'RON',grossBani:120000});
  });
});
