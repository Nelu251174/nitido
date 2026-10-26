// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://nitido.ro/rezervare"}
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({push:vi.fn(),gps:vi.fn()}));
vi.mock('./OwnedHomePicker',()=>({OwnedHomePicker:()=>null}));
vi.mock('./FlexibleChoice',()=>({FlexibleChoice:()=>null}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:state.push}),usePathname:()=>'/rezervare'}));
vi.mock('next-intl',()=>({useMessages:()=>({ui:{}}),useLocale:()=> 'ro'}));
vi.mock('@/lib/bookingLocation',()=>({currentBookingCity:state.gps}));
vi.mock('@/lib/useAppPlatform',()=>({useAppPlatform:()=> 'web'}));
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=> 'web'}}));
import {BookingConfigurator} from './BookingConfigurator';
import {BookingEstimator} from './BookingEstimator';
import {BookingLocation} from './BookingLocation';
import {GoogleAdsConsent,AdsCookieSettingsButton} from './GoogleAdsConsent';
import {saveAdsConsent} from '@/lib/googleAds';
let container:HTMLDivElement,root:Root;
const options=[{key:'apartament' as const,label:'Apartament',enabled:true}];
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 sessionStorage.clear();localStorage.clear();state.push.mockReset();state.gps.mockReset();window.nitidoAds=undefined;window.dataLayer=[];window.gtag=undefined;
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:204})));
 vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{cb(0);return 1;});
 Element.prototype.scrollIntoView=vi.fn();window.matchMedia=vi.fn().mockReturnValue({matches:true});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(()=>root.unmount());container.remove();document.querySelector('#nitido-google-ads')?.remove();vi.unstubAllGlobals();});
async function render(node:React.ReactNode){await act(()=>root.render(node));}
async function input(selector:string,value:string){const field=container.querySelector<HTMLInputElement>(selector)!;await act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});}
async function click(text:string){const button=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes(text));expect(button,text).toBeTruthy();await act(()=>button!.click());}
async function submit(){await act(()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
it('transfers manual city and 80 m² from home without asking GPS or scheduling',async()=>{
 await render(React.createElement(BookingEstimator,{options}));expect(state.gps).not.toHaveBeenCalled();expect(container.querySelector('input[type=date]')).toBeNull();
 await input('input[list]','Iași');await submit();const url=state.push.mock.calls[0][0] as string;expect(url).toContain('sqm=80');expect(new URL(url,'https://nitido.ro').searchParams.get('city')).toBe('Iași');
});
it('handles GPS denial only after the optional action and keeps the manual path usable',async()=>{
 state.gps.mockRejectedValue(new Error('GPS refuzat. Introdu localitatea manual.'));const detected=vi.fn();await render(React.createElement(BookingLocation,{city:'',onDetected:detected}));expect(state.gps).not.toHaveBeenCalled();await click('Folosește locația mea');expect(detected).not.toHaveBeenCalled();expect(container.textContent).toContain('Introdu localitatea manual');
});
it('focuses the invalid field, preserves steps and restores edited selections after reload',async()=>{
 const initial={sqm:'80'};await render(React.createElement(BookingConfigurator,{initial,options}));await submit();expect(document.activeElement?.id).toBe('booking-city');
 await input('#booking-city','Iași');await input('#booking-area','90');await submit();expect(container.textContent).toContain('Când și cum rezervi');await submit();expect(container.textContent).toContain('Totul este pregătit');await click('Modifică spațiul');expect(container.querySelector<HTMLInputElement>('#booking-area')?.value).toBe('90');
 await act(()=>root.unmount());root=createRoot(container);await render(React.createElement(BookingConfigurator,{initial,options}));expect(container.querySelector<HTMLInputElement>('#booking-area')?.value).toBe('90');expect(container.querySelector<HTMLInputElement>('#booking-city')?.value).toBe('Iași');
});
it('shows 1200 → 1320 → 1420 lei and hands off without publishing or payment',async()=>{
 await render(React.createElement(BookingConfigurator,{initial:{city:'Iași',sqm:'80'},options}));expect(container.querySelector('output')?.textContent).toBe('1200 lei');
 await input('#booking-windowsSqm','10');expect(container.querySelector('output')?.textContent).toBe('1320 lei');await input('#booking-bathroomCount','2');expect(container.querySelector('output')?.textContent).toBe('1420 lei');await submit();await submit();await submit();expect(state.push).toHaveBeenCalledTimes(1);expect(state.push.mock.calls[0][0]).toContain('bathroomCount=2');expect(fetch).not.toHaveBeenCalled();
});
it('keeps refusal through navigation and loads no advertising script, then reopens settings to accept',async()=>{
 await render(React.createElement(React.Fragment,null,React.createElement(GoogleAdsConsent,{}),React.createElement(AdsCookieSettingsButton,{})));
 expect(document.querySelector('#nitido-google-ads')).toBeNull();await click('Refuz cookie-urile');expect(container.querySelector('section')).toBeNull();expect(document.querySelector('#nitido-google-ads')).toBeNull();
 await click('Preferințe cookie-uri');expect(container.querySelector('section')).toBeTruthy();await click('Accept cookie-urile');expect(document.querySelector('#nitido-google-ads')).toBeTruthy();expect(container.querySelector('section')).toBeNull();
});
it('records no funnel event on refusal, then sanitized steps once after consent including refresh',async()=>{
 saveAdsConsent(false);await render(React.createElement(BookingConfigurator,{initial:{city:'PRIVATE-CITY',sqm:'80'},options}));expect(fetch).not.toHaveBeenCalled();
 await act(()=>saveAdsConsent(true));await submit();await submit();expect(fetch).toHaveBeenCalled();
 const payloads=vi.mocked(fetch).mock.calls.map(([,options])=>String(options?.body));expect(payloads.join('')).not.toContain('PRIVATE-CITY');expect(payloads.join('')).not.toContain('sqm');expect(payloads.filter(p=>p.includes('"event":"start"'))).toHaveLength(1);
 await act(()=>root.unmount());root=createRoot(container);await render(React.createElement(BookingConfigurator,{initial:{city:'PRIVATE-CITY',sqm:'80'},options}));expect(vi.mocked(fetch).mock.calls.filter(([,o])=>String(o?.body).includes('"event":"start"'))).toHaveLength(1);
});

it('keeps malformed date input recoverable instead of crashing the configurator',async()=>{await render(React.createElement(BookingConfigurator,{initial:{city:'Iași',sqm:'80',date:'not-a-date',spaceType:'unsupported'},options}));expect(container.textContent).toContain('Alege data');await submit();await submit();expect(document.activeElement?.id).toBe('booking-date');});
