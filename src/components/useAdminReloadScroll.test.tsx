// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useAdminReloadScroll} from './useAdminReloadScroll';
let root:Root,container:HTMLDivElement,navigation='reload';
const entries=Object.getOwnPropertyDescriptor(window.performance,'getEntriesByType');
function Setup({ready}:{ready:boolean}){useAdminReloadScroll(ready);return null;}
beforeEach(()=>{vi.useFakeTimers();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});navigation='reload';Object.defineProperty(window.performance,'getEntriesByType',{configurable:true,value:()=>[{type:navigation}]});Object.defineProperty(window.history,'scrollRestoration',{configurable:true,writable:true,value:'auto'});vi.stubGlobal('scrollTo',vi.fn());vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>setTimeout(()=>cb(0),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));window.history.replaceState({fixture:'preserve'},'','/admin?focusJob=fixture#performanta');container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals();if(entries)Object.defineProperty(window.performance,'getEntriesByType',entries);else Reflect.deleteProperty(window.performance,'getEntriesByType');});
async function render(ready:boolean){await act(()=>root.render(<Setup ready={ready}/>));}
it('drops only a stale reload anchor, preserving query parameters and Next history state',async()=>{await render(false);expect(location.hash).toBe('');expect(location.search).toBe('?focusJob=fixture');expect(history.state).toEqual({fixture:'preserve'});expect(history.scrollRestoration).toBe('manual');expect(window.scrollTo).toHaveBeenCalledWith({top:0,left:0,behavior:'instant'});await render(true);await act(()=>vi.runAllTimersAsync());expect(history.scrollRestoration).toBe('auto');});
it.each(['navigate','back_forward'])('preserves intentional %s destinations and native history behavior',async type=>{navigation=type;await render(true);await act(()=>vi.runAllTimersAsync());expect(location.hash).toBe('#performanta');expect(history.scrollRestoration).toBe('auto');expect(window.scrollTo).not.toHaveBeenCalled();});
it('also resets a plain reload without a fragment',async()=>{history.replaceState(history.state,'','/admin');await render(true);await act(()=>vi.runAllTimersAsync());expect(window.scrollTo).toHaveBeenCalled();expect(location.pathname).toBe('/admin');});
it('does not move the page again on ordinary dashboard updates',async()=>{await render(true);await act(()=>vi.runAllTimersAsync());vi.mocked(window.scrollTo).mockClear();await render(true);await act(()=>vi.runAllTimersAsync());expect(window.scrollTo).not.toHaveBeenCalled();});
it('restores native behavior when the dashboard unmounts during authentication',async()=>{await render(false);expect(history.scrollRestoration).toBe('manual');await act(()=>root.render(null));expect(history.scrollRestoration).toBe('auto');});
