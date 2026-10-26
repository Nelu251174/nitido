import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import {describe,expect,it} from 'vitest';
import {calcGrossPrice,type SpaceType} from '@/lib/pricing';
import {LivePriceEstimator} from './LivePriceEstimator';

function render(type:SpaceType='apartament') {
  const Estimator=()=>LivePriceEstimator({inline:true,options:[{key:type,label:type,enabled:true}]});
  return renderToStaticMarkup(<NextIntlClientProvider locale="ro" timeZone="Europe/Bucharest" messages={{ui:{}}}><Estimator /></NextIntlClientProvider>);
}
function displayedPrice(html:string) {
  const match=html.match(/<b[^>]*aria-live="polite"[^>]*>(\d+)/);
  if(!match)throw new Error('Missing accessible estimate');
  return Number(match[1]);
}
describe('homepage price estimator rendered behavior',()=>{
  it('renders 120 m² and the actual 1740 lei apartment estimate',()=>{
    const html=render();expect(displayedPrice(html)).toBe(1740);
    expect(html).toMatch(/<output[^>]*>120/);
    expect(html).toContain('value="120"');
    expect(html).toContain('120 metri pătrați, estimare 1740 lei');
  });
  it.each([['casa',1680],['birou',1200],['altul',1440]] as const)('uses configured initial type %s to calculate %d lei',(type,price)=>{
    expect(displayedPrice(render(type))).toBe(price);
  });
  it('renders native keyboard/touch range bounds and explicit exclusions',()=>{
    const html=render();expect(html).toMatch(/type="range"[^>]*min="10"[^>]*max="1000"[^>]*step="5"/);
    expect(html).toContain('aria-label="Suprafața estimată în metri pătrați"');
    expect(html).toContain('o baie și o bucătărie incluse');expect(html).toContain('geamurile se adaugă separat');
  });
  it.each([[40,750],[41,1000],[60,1000],[61,1200],[80,1200],[81,1450],[100,1450],[101,1465],[120,1740]])('keeps authoritative threshold %d m² = %d lei',(sqm,price)=>{
    expect(calcGrossPrice('apartament',sqm)).toBe(price);
  });
  it('rejects an intentionally wrong rendered expectation',()=>{
    expect(()=>expect(displayedPrice(render())).toBe(781)).toThrow();
  });
});
