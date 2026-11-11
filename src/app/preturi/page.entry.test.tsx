import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({enabled:false,headers:vi.fn()}));
vi.mock('next/headers',()=>({headers:mocks.headers}));
vi.mock('@/lib/internationalRollout',()=>({internationalPricingEnabled:()=>mocks.enabled}));
vi.mock('@/i18n/server',()=>({localizeMetadata:vi.fn()}));
vi.mock('@/lib/publicSeo',()=>({publicPageMetadata:()=>({})}));
vi.mock('@/components/InformationPage',()=>({InformationPage:()=>null}));
vi.mock('@/components/UiText',()=>({UiText:()=>null,UiTemplate:()=>null}));
import Page from './page';
beforeEach(()=>{mocks.enabled=false;vi.clearAllMocks();mocks.headers.mockResolvedValue(new Headers({'x-forwarded-for':'82.64.0.1'}))});

it('retains the existing Romanian pricing content and booking link when disabled',async()=>{
 const result=await Page();
 expect(result.props.title).toBe('Știi cât plătești înainte să rezervi.');
 expect(result.props.cta.href).toBe('/rezervare');
 expect(result.props.sections.map((s:{title:string})=>s.title)).toContain('Exemple de calcul, fără opțiuni suplimentare');
 expect(mocks.headers).not.toHaveBeenCalled();
});
it('does not present converted Romanian prices as a French local tariff',async()=>{
 mocks.enabled=true;const result=await Page();
 expect(result.props.title).toBe('Un preț local, nu o simplă conversie.');
 expect(result.props.cta.href).toBe('/international/booking?countryCode=FR');
 expect(result.props.sections[0].paragraphs[0]).toBe('Franța');
 expect(result.props.sections.map((s:{title:string})=>s.title)).not.toContain('Exemple de calcul, fără opțiuni suplimentare');
});
it('preserves explicit Romanian prices and domestic booking for a visitor abroad',async()=>{
 mocks.enabled=true;const result=await Page({searchParams:Promise.resolve({countryCode:'RO'})});
 expect(result.props.title).toBe('Știi cât plătești înainte să rezervi.');
 expect(result.props.cta.href).toBe('/rezervare?countryCode=RO');
});
it('keeps an unsupported real connection country out of local tariff assumptions',async()=>{
 mocks.enabled=true;mocks.headers.mockResolvedValue(new Headers({'x-forwarded-for':'8.8.8.8'}));
 const result=await Page();
 expect(result.props.cta.href).toBe('/international/booking');
 expect(result.props.sections[0].paragraphs[0]).toBe('Alege țara');
});
