import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({enabled:false,headers:vi.fn(),redirect:vi.fn(),options:vi.fn(()=>({synthetic:true}))}));
vi.mock('next/headers',()=>({headers:mocks.headers}));
vi.mock('next/navigation',()=>({redirect:mocks.redirect}));
vi.mock('@/lib/internationalRollout',()=>({internationalPricingEnabled:()=>mocks.enabled}));
vi.mock('@/i18n/server',()=>({localizeMetadata:vi.fn()}));
vi.mock('@/components/SiteChrome',()=>({SiteHeader:()=>null,SiteFooter:()=>null}));
vi.mock('@/components/BookingConfigurator',()=>({BookingConfigurator:()=>null}));
vi.mock('@/lib/estimatorConfig',()=>({getActiveEstimatorOptions:mocks.options}));
vi.mock('@/lib/db',()=>({db:{}}));
import Page from './page';
beforeEach(()=>{
 mocks.enabled=false;vi.clearAllMocks();
 mocks.headers.mockResolvedValue(new Headers({'x-forwarded-for':'82.64.0.1'}));
 mocks.redirect.mockImplementation((url:string)=>{throw Error('redirect:'+url)});
});

it('keeps the Romanian page and estimator without consulting IP when disabled',async()=>{
 await Page({searchParams:Promise.resolve({city:'Constanța',sqm:'60'})});
 expect(mocks.headers).not.toHaveBeenCalled();expect(mocks.redirect).not.toHaveBeenCalled();
 expect(mocks.options).toHaveBeenCalledOnce();
});
it('defers the IP suggestion until same-tab Romanian drafts have been checked',async()=>{
 mocks.enabled=true;
 const page=await Page({searchParams:Promise.resolve({})});
 expect(page.props.children[1].props.children.props.destination).toBe('/international/booking?countryCode=FR');
 expect(mocks.redirect).not.toHaveBeenCalled();expect(mocks.options).toHaveBeenCalledOnce();
});
it('keeps the return-to-Romania link and existing booking context in Romania',async()=>{
 mocks.enabled=true;
 await Page({searchParams:Promise.resolve({countryCode:'RO'})});
 await Page({searchParams:Promise.resolve({city:'Constanța',sqm:'60'})});
 expect(mocks.redirect).not.toHaveBeenCalled();expect(mocks.options).toHaveBeenCalledTimes(2);
});
