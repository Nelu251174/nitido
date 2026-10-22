// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('next/navigation',()=>({usePathname:()=>'/client/proprietati'}));
vi.mock('@/components/UiText',()=>({UiText:({text}:{text:string})=><>{text}</>,UiElement:({as:Tag='div',children,...props}:React.PropsWithChildren<Record<string,unknown>>)=>React.createElement(Tag as string,props,children)}));
import {FavoriteFirms,SaveFavoriteButton} from './FavoriteFirms';
import {AvailabilityAlerts} from './AvailabilityAlerts';
import {ClientMobileNavigation} from './ClientMobileNavigation';
let root:Root,container:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container);window.history.replaceState(null,'','/client');});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.unstubAllGlobals()});
async function render(node:React.ReactNode){await act(()=>root.render(node));}
it('offers NEW navigation from client subpages rather than only the public homepage',async()=>{await render(<ClientMobileNavigation/>);const link=container.querySelector('a[href="/client#sec-noutati"]');expect(link?.textContent).toContain('NEW');expect(container.querySelectorAll('a')).toHaveLength(5);expect(link?.getAttribute('aria-current')).toBeNull();});
it('does not invite a firm on page load or while saving a preference',async()=>{
  const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?{ok:true}:{firms:[{id:'f',name:'Firm',coverage_city:'Constanța',verified:1,suspended_until:null,saved:0}]}));vi.stubGlobal('fetch',fetcher);await render(<FavoriteFirms/>);
  expect(fetcher).toHaveBeenCalledTimes(1);expect(container.querySelector('a[href*="preferredFirmId"]')).toBeNull();await act(()=>container.querySelector('button')!.click());
  expect(JSON.parse(String(fetcher.mock.calls.find(c=>c[1])?.[1]?.body))).toEqual({firmId:'f',save:true});expect(container.textContent).toContain('Nu s-a trimis o invitație');
});
it('locks repeated save taps until the server confirms the mutation',async()=>{
  let resolve!:(r:Response)=>void;const fetcher=vi.fn(()=>new Promise<Response>(r=>{resolve=r}));vi.stubGlobal('fetch',fetcher);await render(<SaveFavoriteButton firmId="f"/>);await act(()=>{container.querySelector('button')!.click();container.querySelector('button')!.click()});expect(fetcher).toHaveBeenCalledTimes(1);expect(container.querySelector('button')!.disabled).toBe(true);await act(()=>resolve(Response.json({error:'Nu este eligibilă'},{status:400})));expect(container.textContent).toContain('Nu este eligibilă');expect(container.textContent).not.toContain('Firma este salvată');
});
it('requires fresh explicit alert consent and hides unavailable external channels',async()=>{
  const fetcher=vi.fn(async()=>Response.json({enabled:true,channels:{inapp:true,push:false,email:false},subscriptions:[],batches:[]}));vi.stubGlobal('fetch',fetcher);await render(<AvailabilityAlerts/>);
  const checks=Array.from(container.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));expect(checks).toHaveLength(4);expect(checks[0].checked).toBe(true);expect(checks[1].disabled).toBe(true);expect(checks[2].disabled).toBe(true);expect(checks[3].checked).toBe(false);expect(container.querySelector('button')!.disabled).toBe(true);expect(fetcher).toHaveBeenCalledTimes(1);expect(container.textContent).toContain('nu rezervă locul');
});
