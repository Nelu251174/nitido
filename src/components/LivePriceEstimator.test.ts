import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import {describe,expect,it} from 'vitest';
import {calcGrossPrice,type SpaceType} from '@/lib/pricing';
import {LivePriceEstimator} from './LivePriceEstimator';

function render(type:SpaceType='apartament') {
  const Estimator=()=>LivePriceEstimator({inline:true,options:[{key:type,label:type,enabled:true}]});
  return renderToStaticMarkup(createElement(NextIntlClientProvider,{locale:'ro',timeZone:'Europe/Bucharest',messages:{ui:{}},children:createElement(Estimator)}));
}
function displayedPrice(html:string) {
  const match=html.match(/<b[^>]*aria-live="polite"[^>]*>(\d+)/);
  if(!match)throw new Error('Missing accessible estimate');
  return Number(match[1]);
}
describe('homepage price estimator rendered behavior',()=>{
  it('renders 120 m² and the actual 780 lei apartment estimate',()=>{
    const html=render();expect(displayedPrice(html)).toBe(780);
    expect(html).toMatch(/<output[^>]*>120/);
    expect(html).toContain('value="120"');
    expect(html).toContain('120 metri pătrați, estimare 780 lei');
  });
  it.each([['casa',840],['birou',600],['altul',720]] as const)('uses configured initial type %s to calculate %d lei',(type,price)=>{
    expect(displayedPrice(render(type))).toBe(price);
  });
  it('renders native keyboard/touch range bounds and explicit exclusions',()=>{
    const html=render();expect(html).toMatch(/type="range"[^>]*min="10"[^>]*max="1000"[^>]*step="5"/);
    expect(html).toContain('aria-label="Suprafața estimată în metri pătrați"');
    expect(html).toContain('Geamurile se adaugă separat la rezervare.');
  });
  it.each([[40,350],[41,450],[60,450],[61,550],[80,550],[81,650],[100,650],[101,657],[120,780]])('keeps authoritative threshold %d m² = %d lei',(sqm,price)=>{
    expect(calcGrossPrice('apartament',sqm)).toBe(price);
  });
  it('rejects an intentionally wrong rendered expectation',()=>{
    expect(()=>expect(displayedPrice(render())).toBe(781)).toThrow();
  });
});
