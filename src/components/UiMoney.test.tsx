import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import {describe,it,expect} from 'vitest';
import {UiMoney} from './UiMoney';
import {UiText,UiTemplate} from './UiText';
import {CurrencyNotice} from './CurrencyNotice';
const render=(node:React.ReactNode,currency='EUR',rate='5',locale='en')=>renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={{ui:{},displayCurrency:{country:'FR',currency,eurRon:rate,rateDate:'2026-10-29'}}}>{node}</NextIntlClientProvider>);
describe('visible conversion and disclosure',()=>{
 it('shows a genuinely converted quote and keeps area unchanged',()=>expect(render(<UiTemplate text="{p0}–{p1} m²: {p2} lei" values={[1,80,1200]}/>)).toBe('1–80 m²: €240.00'));
 it('converts signed lines and fixed-point display values',()=>expect(render(<><UiMoney ron={1200}/><UiMoney ron={-20}/></>)).toContain('€240.00-€4.00'));
 it('keeps domestic source text exact',()=>expect(render(<UiTemplate text="{p0} lei" values={[1200]}/>,'RON')).toBe('1200 lei'));
 it('converts every operand in the marked pricing example',()=>expect(render(<UiTemplate text="{p0} + {p1} = {p2} lei" moneySlots={[0,1,2]} values={[1000,100,1100]}/>)).toBe('€200.00 + €20.00 = €220.00'));
 it('discloses the bank reference date and actual payment currency',()=>{const html=render(<CurrencyNotice/>);expect(html).toContain('2026-10-29');expect(html).toContain('payment is collected in RON');});
 it('shows RON and an explicit notice when conversion is unavailable',()=>{const html=render(<><UiMoney ron={1200}/><CurrencyNotice/></>,'EUR','');expect(html).toContain('RON');expect(html).toContain('temporarily unavailable');expect(html).not.toContain('€');});
 it.each(['ro','en','fr','de','bg','hr','cs','da','nl'])('formats EUR with language %s without changing the underlying amount',locale=>{const html=render(<><UiMoney ron={1200}/><UiText text="500 lei"/></>,'EUR','5',locale);expect(html).toContain('€');expect(html).not.toContain('1200');expect(html).not.toContain('500');});
});
