import {it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next-intl',()=>({useLocale:()=> 'en',useMessages:()=>({displayCurrency:{country:'US',currency:'EUR',eurRon:5,rateDate:'2026-11-02'}})}));
import {UiMoney,ChargeAmount} from './UiMoney';

it('renders native EUR exactly once while preserving the legacy RON display conversion',()=>{
 expect(renderToStaticMarkup(createElement(UiMoney,{ron:100,currency:'EUR'}))).toBe('€100.00');
 expect(renderToStaticMarkup(createElement(UiMoney,{ron:100}))).toBe('€20.00');
 expect(renderToStaticMarkup(createElement(ChargeAmount,{ron:100,currency:'EUR'}))).toBe('');
 expect(renderToStaticMarkup(createElement(ChargeAmount,{ron:100}))).toContain('RON');
 expect(renderToStaticMarkup(createElement(UiMoney,{ron:100,currency:null}))).toBe('—');
});
