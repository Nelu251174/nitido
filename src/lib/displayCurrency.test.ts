import {describe,it,expect} from 'vitest';
import {currencyForCountry,displayMoney,displayMoneyText,currencyFromMessages} from './displayCurrency';
const eur={country:'FR',currency:'EUR' as const,eurRon:5,rateDate:'2026-10-29'};
const ron={...eur,country:'RO',currency:'RON' as const};
describe('country-driven display currency, separate from contractual RON',()=>{
 it.each(['FR','DE','ES','IT','MD','US','GB','CH','AE','JP'])('uses EUR for %s including non-EU countries',c=>expect(currencyForCountry(c)).toBe('EUR'));
 it('keeps Romania and unknown detection in RON',()=>{expect(currencyForCountry('RO')).toBe('RON');expect(currencyForCountry(null)).toBe('RON');});
 it('converts numeric value rather than relabeling it',()=>{expect(displayMoney(1200,eur,'en')).toBe('€240.00');expect(displayMoney(1200,ron,'en')).toContain('1,200.00');});
 it('preserves zero, credit signs, null and decimal rates',()=>{expect(displayMoney(0,eur,'en')).toBe('€0.00');expect(displayMoney(-20,eur,'en')).toBe('-€4.00');expect(displayMoney(null,eur)).toBe('—');expect(displayMoney(14.5,eur,'en')).toBe('€2.90');});
 it('never invents a rate on provider failure',()=>{expect(displayMoney(100,{...eur,eurRon:null},'en')).toContain('RON');expect(displayMoney(100,{...eur,eurRon:0},'en')).toContain('RON');});
 it('converts monetary source text without touching square metres or dates',()=>{expect(displayMoneyText('80 m², 29.10.2026: 1.200 lei + 14,50 lei/m²',eur,'en')).toBe('80 m², 29.10.2026: €240.00 + €2.90/m²');expect(displayMoneyText('500 lei',ron)).toBe('500 lei');});
 it('converts both ends of a monetary interval',()=>expect(displayMoneyText('450–600 lei',eur,'en')).toBe('€90.00–€120.00'));
 it('does not treat missing context as a foreign visitor',()=>expect(currencyFromMessages({ui:{}}).currency).toBe('RON'));
});
