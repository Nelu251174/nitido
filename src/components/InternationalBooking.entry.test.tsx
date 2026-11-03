// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('next-intl',()=>({useLocale:()=> 'fr'}));
vi.mock('next/link',()=>({default:({children,...props}:React.ComponentProps<'a'>)=><a {...props}>{children}</a>}));
vi.mock('./LanguageSelector',()=>({LanguageSelector:()=>null}));
vi.mock('./InternationalBookingLocation',()=>({InternationalBookingLocation:({onDetected,onLocate}:{onDetected:(a:{countryCode:string;city:string;street:string;postalCode:string})=>void;onLocate:()=>void})=><button type="button" onClick={()=>{onLocate();onDetected({countryCode:'ES',city:'madrid',street:'Calle Nueva 12',postalCode:'28001'});}}>GPS fixture confirmation</button>}));
vi.mock('@/components/UiText',()=>({UiText:({text}:{text:string})=><>{text}</>,UiElement:({as:Tag,...props}:{as:React.ElementType;[key:string]:unknown})=><Tag {...props}/>}));
import {InternationalBooking} from './InternationalBooking';
const markets=[{code:'FR',name:'France',timeZone:'Europe/Paris',cities:[{key:'paris',name:'Paris'}]},
 {code:'ES',name:'España',timeZone:'Europe/Madrid',cities:[{key:'madrid',name:'Madrid'}]}];
let root:Root,el:HTMLDivElement,resolveContext:(value:Response)=>void;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 el=document.createElement('div');document.body.append(el);root=createRoot(el);
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{resolveContext=resolve})));
});
afterEach(async()=>{await act(()=>root.unmount());el.remove();vi.unstubAllGlobals()});
async function render(initialCountryCode?:string){await act(()=>root.render(<InternationalBooking markets={markets} initialCountryCode={initialCountryCode}/>))}
function choose(value:string){const select=el.querySelector<HTMLSelectElement>('select[aria-label="Țara lucrării"]')!;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}
async function detect(country:string){await act(async()=>{resolveContext(Response.json({country}));await Promise.resolve()})}

it('preserves a manual country selection and an explicit clear when the IP lookup finishes late',async()=>{
 await render();await act(()=>choose('ES'));await detect('FR');
 expect(el.querySelector<HTMLSelectElement>('select')!.value).toBe('ES');
});
it('does not override an explicitly cleared country with late geolocation',async()=>{
 await render();await act(()=>choose('ES'));await act(()=>choose(''));await detect('FR');
 expect(el.querySelector<HTMLSelectElement>('select')!.value).toBe('');
});
it('preserves an explicitly unselected server country when geolocation finishes',async()=>{
 await render('');await detect('FR');
 expect(el.querySelector<HTMLSelectElement>('select')!.value).toBe('');
});
it('uses the server-selected work country and provides a loop-free Romanian return',async()=>{
 await render('ES');await detect('FR');
 expect(el.querySelector<HTMLSelectElement>('select')!.value).toBe('ES');
 expect([...el.querySelectorAll('a')].find(a=>a.textContent?.includes('Rezervă în România'))?.getAttribute('href')).toBe('/rezervare?countryCode=RO');
});

it('formats the stored EUR quote in the selected language and clears it after a country change',async()=>{
 await render('ES');await detect('FR');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({quote:{id:'synthetic-quote',expiresAt:'2026-12-01T12:00:00Z',
  context:{countryCode:'ES',city:'madrid',spaceType:'apartament',service:'maintenance',sqm:75,requestedDurationMinutes:180},
  pricing:{currency:'EUR',countryCode:'ES',city:'madrid',durationMinutes:180,workers:1,personMinutes:180,
   netMinor:1000000,vatMinor:234567,vatBps:2345,clientTotalMinor:1234567,lines:[]}}})));
 const input=el.querySelector<HTMLInputElement>('input[type="number"]')!;
 await act(()=>{
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'75');
  input.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await act(()=>{[...el.querySelectorAll('button')].find(b=>b.textContent?.includes('Verifică prețul'))!.click()});
 expect(el.textContent).toContain(new Intl.NumberFormat('fr',{style:'currency',currency:'EUR'}).format(12345.67));
 expect(el.textContent).not.toContain(new Intl.NumberFormat('ro-RO',{style:'currency',currency:'EUR'}).format(12345.67));
 expect(el.querySelector('input[autocomplete="street-address"]')).not.toBeNull();
 await act(()=>choose('FR'));
 expect(el.querySelector('input[autocomplete="street-address"]')).toBeNull();
 expect(el.textContent).not.toContain(new Intl.NumberFormat('fr',{style:'currency',currency:'EUR'}).format(12345.67));
});

it('does not carry an old floor or schedule to a different street in the same city',async()=>{
 await render('ES');await detect('ES');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({quote:{id:'synthetic-quote',expiresAt:'2026-12-01T12:00:00Z',
  context:{countryCode:'ES',city:'madrid',spaceType:'apartament',service:'maintenance',sqm:75,requestedDurationMinutes:180},
  pricing:{currency:'EUR',countryCode:'ES',city:'madrid',durationMinutes:180,workers:1,personMinutes:180,netMinor:10000,vatMinor:2100,vatBps:2100,clientTotalMinor:12100,lines:[]}}})));
 async function input(field:HTMLInputElement,value:string){await act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});}
 async function price(){await act(async()=>{[...el.querySelectorAll('button')].find(b=>b.textContent?.includes('Verifică prețul'))!.click();await Promise.resolve();});}
 await input(el.querySelector('input[type="number"]')!,'75');await price();
 await input(el.querySelector('input[autocomplete="street-address"]')!,'Calle Anterior 1');
 const floor=el.querySelectorAll<HTMLInputElement>('input:not([type="number"]):not([type="checkbox"]):not([autocomplete])')[0];
 await input(floor,'9');await input(el.querySelector('input[type="datetime-local"]')!,'2026-12-10T10:00');
 await act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='GPS fixture confirmation')!.click());
 expect(el.querySelector('input[autocomplete="street-address"]')).toBeNull();await price();
 expect(el.querySelector<HTMLInputElement>('input[autocomplete="street-address"]')!.value).toBe('Calle Nueva 12');
 expect(el.querySelector<HTMLInputElement>('input[type="datetime-local"]')!.value).toBe('');
 expect(el.querySelectorAll<HTMLInputElement>('input:not([type="number"]):not([type="checkbox"]):not([autocomplete])')[0].value).toBe('');
});
