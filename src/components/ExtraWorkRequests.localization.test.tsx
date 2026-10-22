// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {NextIntlClientProvider} from 'next-intl';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import manifest from '../../messages/manifest.json';
import scope from '../../messages/extra-work-source.json';
import {textKey} from '@/i18n/text';
import {CATALOG_CATEGORIES} from '@/lib/serviceCatalog';
const auth=vi.hoisted(()=>({user:{id:'client-test',role:'client'} as {id:string;role:string}|null,error:null as string|null,retry:vi.fn()}));
vi.mock('@/lib/useCurrentUser',()=>({useCurrentUser:()=>({...auth,loading:false})}));
import {ExtraWorkRequests} from './ExtraWorkRequests';
let root:Root,el:HTMLDivElement;
const catalogs=Object.fromEntries(manifest.locales.map(locale=>[locale,JSON.parse(readFileSync(resolve('messages',locale+'.json'),'utf8')) as Record<string,string>]));
const proposal={id:'proposal-test',revision:1,status:'proposed',terms:{category:'general',description:'Camere',proposedBani:12345,sqm:20,rooms:1,bathrooms:0,difficulty:'normal'},expiresAt:'2027-03-28T12:00:00Z',createdAt:'2027-03-27T12:00:00Z',assessmentId:null};
beforeEach(()=>{auth.user={id:'client-test',role:'client'};auth.error=null;auth.retry.mockReset();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});el=document.createElement('div');document.body.append(el);root=createRoot(el)});
afterEach(async()=>{await act(()=>root.unmount());el.remove();vi.unstubAllGlobals()});
const t=(locale:string,source:string)=>catalogs[locale][textKey(source)];
async function render(locale:string){await act(()=>root.render(<NextIntlClientProvider locale={locale} messages={{ui:catalogs[locale]}} timeZone="Europe/Bucharest"><ExtraWorkRequests jobId="job-test"/></NextIntlClientProvider>))}
function button(locale:string,source:string){const b=[...el.querySelectorAll('button')].find(b=>b.textContent===t(locale,source));if(!b)throw Error('Missing localized button '+source);return b;}
for(const locale of manifest.locales){
 it(`covers the complete supplement copy inventory in ${locale}`,()=>{
  expect(scope).toHaveLength(70);
  for(const source of scope){expect(t(locale,source),source).toBeTruthy();if(locale!=='ro')expect(t(locale,source),source).not.toBe(source);}
 });
 it(`renders proposal terms and every state in ${locale} without translating user content`,async()=>{
  const states=['Propus pentru evaluare','Acceptat pentru evaluare','Refuzat','Retras','Expirat','Context schimbat — propunere nevalabilă'];
  const values=['proposed','approved','rejected','withdrawn','expired','outdated'];
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({role:'client',canPropose:false,proposals:values.map((status,i)=>({...proposal,id:'p'+i,status,assessmentId:i===1?'assessment-test':null}))})));
  await render(locale);
  for(const source of [...states,'Suplimente propuse pentru evaluare','Curățenie generală','Obișnuită','Acceptă pentru evaluare','Refuză propunerea','Vezi evaluările mele','Valabilă până la'])expect(el.textContent).toContain(t(locale,source));
  expect(el.querySelector('.whitespace-pre-wrap')?.textContent).toBe('Camere');
  expect(el.textContent).toContain(new Intl.NumberFormat(locale,{style:'currency',currency:'RON'}).format(123.45));
  expect(el.textContent).toContain(new Intl.DateTimeFormat(locale,{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'}).format(new Date(proposal.expiresAt)));
  expect(button(locale,'Acceptă pentru evaluare').disabled).toBe(true);
  expect(el.querySelector('a')?.getAttribute('href')).toBe('/client/evaluari');
 });
 it(`renders the complete firm form, categories and empty state in ${locale}`,async()=>{
  auth.user={id:'firm-test',role:'firma'};
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({role:'firma',canPropose:true,proposals:[]})));
  await render(locale);
  for(const source of ['Propune un supliment','Serviciu solicitat','Ce include suplimentul și de ce este necesar?','Sumă propusă pentru evaluare, lei','Suprafața suplimentului pentru evaluare, m²','Camere','Băi','Dificultate','Alege dificultatea','Redusă','Obișnuită','Ridicată','Trimite propunerea pentru client','Nu există propuneri suplimentare pentru această lucrare.',...CATALOG_CATEGORIES.map(c=>c[1])])expect(el.textContent).toContain(t(locale,source));
  expect([...el.querySelectorAll('select')][0].value).toBe('general');
  await act(()=>el.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(el.querySelector('[role=alert]')?.textContent).toBe(t(locale,'Introdu suma în lei, cu maximum două zecimale.'));
 });
 it(`localizes approval feedback and keeps the consent payload and destination unchanged in ${locale}`,async()=>{
  let approved=false;
  const fetcher=vi.fn(async(_url:string,init?:RequestInit)=>{if(init?.method==='POST'){approved=true;return Response.json({ok:true});}return Response.json({role:'client',canPropose:false,proposals:[{...proposal,status:approved?'approved':'proposed',assessmentId:approved?'assessment-test':null}]});});
  vi.stubGlobal('fetch',fetcher);await render(locale);
  expect(el.textContent).toContain(t(locale,'Accept trimiterea la evaluare. Înțeleg că nu confirm o plată, o rezervare sau începerea suplimentului.'));
  await act(()=>el.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  await act(()=>{button(locale,'Acceptă pentru evaluare').click();button(locale,'Acceptă pentru evaluare').click();});
  expect(el.querySelector('[role=status]')?.textContent).toBe(t(locale,'Propunerea a fost trimisă la evaluare. Nu s-a creat o rezervare și nu s-a autorizat cardul.'));
  const writes=fetcher.mock.calls.filter(c=>c[1]?.method==='POST');expect(writes).toHaveLength(1);
  expect(JSON.parse(String(writes[0][1]!.body))).toEqual({action:'approve',id:proposal.id,revision:1,acknowledgeNoPayment:true});
  expect(fetcher.mock.calls.every(c=>c[0]==='/api/jobs/job-test/extra-work')).toBe(true);
 });
 it(`localizes server conflicts and recovers an offline read in ${locale}`,async()=>{
  const conflict='Propunerea s-a schimbat. Actualizează înainte de a continua.';
  vi.stubGlobal('fetch',vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockImplementation(async(_url:string,init?:RequestInit)=>init?.method==='POST'?Response.json({error:conflict},{status:409}):Response.json({role:'client',canPropose:false,proposals:[proposal]})));
  await render(locale);expect(el.querySelector('[role=alert]')?.textContent).toBe(t(locale,'Conexiune indisponibilă.'));
  await act(()=>button(locale,'Actualizează propunerile').click());
  await act(()=>el.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  await act(()=>button(locale,'Acceptă pentru evaluare').click());
  expect(el.querySelector('[role=alert]')?.textContent).toBe(t(locale,conflict));
  expect(el.querySelector('a')).toBeNull();
 });
 it(`localizes saved changes when refreshing fails in ${locale}`,async()=>{
  let saved=false;
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init?:RequestInit)=>{if(init?.method==='POST'){saved=true;return Response.json({ok:true});}if(saved)throw new TypeError('Network failure');return Response.json({role:'client',canPropose:false,proposals:[proposal]});}));
  await render(locale);await act(()=>button(locale,'Refuză propunerea').click());
  expect(el.querySelector('[role=status]')?.textContent).toBe(t(locale,'Modificarea a fost salvată. Actualizează propunerile pentru starea curentă.'));
  expect(el.querySelector('[role=alert]')).toBeNull();
 });
 it(`localizes authentication retry without requesting job data in ${locale}`,async()=>{
  auth.user=null;auth.error='Conexiunea nu permite verificarea contului. Reîncearcă.';const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  await render(locale);expect(el.querySelector('[role=alert]')?.textContent).toContain(t(locale,auth.error));
  await act(()=>button(locale,'Reîncearcă').click());expect(auth.retry).toHaveBeenCalledOnce();expect(fetcher).not.toHaveBeenCalled();
 });
}
