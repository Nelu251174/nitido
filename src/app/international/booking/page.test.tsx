import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({enabled:true,headers:vi.fn(),user:vi.fn(),redirect:vi.fn(),notFound:vi.fn()}));
vi.mock('next/headers',()=>({headers:mocks.headers}));
vi.mock('next/navigation',()=>({redirect:mocks.redirect,notFound:mocks.notFound}));
vi.mock('@/lib/internationalRollout',()=>({internationalPricingEnabled:()=>mocks.enabled}));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('@/components/InternationalBooking',()=>({InternationalBooking:()=>null}));
import Page from './page';
import {postAuthDestination} from '@/lib/authRedirect';
beforeEach(()=>{
 mocks.enabled=true;vi.clearAllMocks();mocks.headers.mockResolvedValue(new Headers({'x-forwarded-for':'82.64.0.1'}));
 mocks.user.mockResolvedValue({id:'synthetic-client',role:'client'});
 mocks.redirect.mockImplementation((url:string)=>{throw Error('redirect:'+url)});
 mocks.notFound.mockImplementation(()=>{throw Error('not-found')});
});
it('keeps an explicit country through sign-in rather than losing it to the client dashboard',async()=>{
 mocks.user.mockResolvedValue(null);
 try{await Page({searchParams:Promise.resolve({countryCode:'ES'})});throw Error('missing-redirect')}
 catch(e){
  expect(String(e)).toContain('redirect:/login?');
  const target=new URL(mocks.redirect.mock.calls[0][0],'https://nitido.invalid').searchParams.get('next');
  expect(target).toBe('/international/booking?countryCode=ES');
  expect(postAuthDestination(target,'client')).toBe(target);
 }
});
it('initializes the confirmed work country independently of the visitor country',async()=>{
 const result=await Page({searchParams:Promise.resolve({countryCode:'ES'})});
 expect(result.props.initialCountryCode).toBe('ES');expect(result.props.initialVisitorCountry).toBe('FR');
 expect(result.props.markets).toHaveLength(26);
});
it('returns to the Romanian flow without an IP redirect loop or extra login',async()=>{
 await expect(Page({searchParams:Promise.resolve({countryCode:'RO'})})).rejects.toThrow('redirect:/rezervare?countryCode=RO');
 expect(mocks.user).not.toHaveBeenCalled();
});
it('keeps disabled international routes unavailable without reading visitor or account context',async()=>{
 mocks.enabled=false;await expect(Page()).rejects.toThrow('not-found');
 expect(mocks.headers).not.toHaveBeenCalled();expect(mocks.user).not.toHaveBeenCalled();
});
it('keeps an explicitly empty/unsupported country unselected through login and hydration',async()=>{
 mocks.user.mockResolvedValue(null);
 await expect(Page({searchParams:Promise.resolve({countryCode:'US'})})).rejects.toThrow('redirect:/login?');
 const next=new URL(mocks.redirect.mock.calls[0][0],'https://nitido.invalid').searchParams.get('next');
 expect(next).toBe('/international/booking?countryCode=');
 mocks.user.mockResolvedValue({id:'synthetic-client',role:'client'});
 const page=await Page({searchParams:Promise.resolve({countryCode:''})});
 expect(page.props.initialCountryCode).toBe('');
});
