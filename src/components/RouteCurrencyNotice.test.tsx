import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import {expect,it,vi} from 'vitest';
const route=vi.hoisted(()=>({path:'/client'}));
vi.mock('next/navigation',()=>({usePathname:()=>route.path}));
import {RouteCurrencyNotice} from './RouteCurrencyNotice';
function render(path:string,rate='5'){
 route.path=path;
 return renderToStaticMarkup(<NextIntlClientProvider locale="en" messages={{ui:{},displayCurrency:{country:'FR',currency:'EUR',eurRon:rate,rateDate:'2026-11-02'}}}><RouteCurrencyNotice/></NextIntlClientProvider>);
}
it.each(['/international/booking','/international/preview'])('does not describe native EUR offers as RON or unavailable FX at %s',path=>{
 expect(render(path)).toBe('');expect(render(path,'')).toBe('');
});
it.each(['/client','/preturi','/rezervare','/international/booking-other'])('preserves the existing Romanian conversion disclosure at %s',path=>{
 expect(render(path)).toContain('payment is collected in RON');
 expect(render(path,'')).toContain('temporarily unavailable');
});
