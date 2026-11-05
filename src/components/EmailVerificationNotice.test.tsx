// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('@/components/UiText',()=>({UiText:({text}:{text:string})=><>{text}</>}));
import {EmailVerificationNotice} from './EmailVerificationNotice';
let root:Root,container:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container)});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.unstubAllGlobals()});
async function mount(){await act(()=>root.render(<EmailVerificationNotice/>))}
it('does not assert that an email was received just because sending is configured',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({verified:false,configured:true})));await mount();expect(container.textContent).toContain('Dacă ai primit emailul');expect(container.textContent).not.toContain('Linkul primit prin email');expect(container.querySelector('button')).not.toBeNull();
});
it('serializes rapid clicks and labels provider acceptance separately from delivery',async()=>{
 let finish!:(r:Response)=>void;const transport=vi.fn((_url:unknown,init?:RequestInit)=>init?.method==='POST'?new Promise<Response>(resolve=>{finish=resolve}):Promise.resolve(Response.json({verified:false,configured:true})));vi.stubGlobal('fetch',transport);await mount();
 const button=container.querySelector('button')!;await act(()=>{button.click();button.click()});expect(transport.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(1);expect(button.disabled).toBe(true);
 await act(()=>finish(Response.json({accepted:true})));expect(container.textContent).toContain('Furnizorul a acceptat mesajul');expect(container.textContent).toContain('livrarea nu este încă confirmată');expect(button.disabled).toBe(false);
});
it.each([new Response('',{status:200}),Response.json({}, {status:200}),Response.json({error:'Serviciu indisponibil'}, {status:503})])('does not turn an empty, malformed or refused response into success',async(response)=>{
 const transport=vi.fn((_url:unknown,init?:RequestInit)=>Promise.resolve(init?.method==='POST'?response:Response.json({verified:false,configured:true})));vi.stubGlobal('fetch',transport);await mount();await act(()=>container.querySelector('button')!.click());expect(container.textContent).not.toContain('Furnizorul a acceptat mesajul');expect(container.querySelector('[role=status]')).not.toBeNull();
});
it('never offers a resend when transport is unconfigured',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({verified:false,configured:false})));await mount();expect(container.textContent).toContain('nu este activată');expect(container.querySelector('button')).toBeNull();
});
