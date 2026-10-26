import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import {describe,it,expect,vi} from 'vitest';
import ro from '../../../messages/ro.json';
import en from '../../../messages/en.json';
vi.mock('@/i18n/server',()=>({localizeMetadata:vi.fn()}));
vi.mock('@/components/SiteChrome',()=>({SiteHeader:()=>null,SiteFooter:()=>null}));
import Page from './page';
function rendered(locale:'ro'|'en'){
 return renderToStaticMarkup(<NextIntlClientProvider locale={locale} timeZone="Europe/Bucharest" messages={{ui:locale==='ro'?ro:en}}><Page/></NextIntlClientProvider>);
}
describe('published tariff explanations',()=>{
 it.each(['ro','en'] as const)('renders current prices and calculated examples in %s with no unresolved slots',locale=>{
  const html=rendered(locale);
  expect(html).toContain('1–40 m²: 750 lei');expect(html).toContain('41–60 m²: 1000 lei');
  expect(html).toContain('61–80 m²: 1200 lei');expect(html).toContain('81–100 m²: 1450 lei');
  expect(html).toContain('1450 lei + 14,50 lei');expect(html).toContain('1000 + 100 = 1100 lei');expect(html).toContain('1100 + 120 = 1220 lei');
  expect(html).not.toMatch(/\{p\d+\}/);expect(html).not.toContain('450 + 50');expect(html).not.toContain('650 lei + 6,50');
 });
 it('uses the released English explanations with the new numbers',()=>{
  const html=rendered('en');expect(html).toContain('Over 100 m²: 1450 lei');expect(html).toContain('100 lei');expect(html).not.toContain('Fiecare baie suplimentară');
 });
});
