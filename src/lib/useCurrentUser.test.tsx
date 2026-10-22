// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useCurrentUser} from './useCurrentUser';
let root:Root,container:HTMLDivElement;
function Probe(){const {user,loading,error,retry}=useCurrentUser();return <div>{loading?'loading':error?'error':user?.id??'signed out'}<button onClick={retry}>retry</button></div>}
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container)});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.unstubAllGlobals()});
it('recovers after a failed network request without hanging on loading',async()=>{const f=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(Response.json({user:{id:'own',role:'client'}}));vi.stubGlobal('fetch',f);await act(()=>root.render(<Probe/>));expect(container.textContent).toContain('error');await act(()=>container.querySelector('button')!.click());expect(container.textContent).toContain('own');expect(f).toHaveBeenCalledTimes(2)});
it.each([Response.json({user:null}),Response.json({error:'Expired'},{status:401})])('distinguishes a signed-out session from an unavailable account',async response=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response));await act(()=>root.render(<Probe/>));expect(container.textContent).toContain('signed out')});
it('handles a malformed auth response as a recoverable error',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({unexpected:true})));await act(()=>root.render(<Probe/>));expect(container.textContent).toContain('error')});
it('does not expose a previous response after unmount',async()=>{let finish!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(r=>{finish=r})));await act(()=>root.render(<Probe/>));await act(()=>root.render(<p>closed</p>));await act(()=>finish(Response.json({user:{id:'late',role:'firma'}})));expect(container.textContent).toBe('closed')});
