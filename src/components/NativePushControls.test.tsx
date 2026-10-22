// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({platform:'ios',register:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=>mock.platform}}));
vi.mock('@capacitor/push-notifications',()=>({PushNotifications:{}}));
vi.mock('@/lib/nativePushClient',()=>({nativePushAvailable:()=>true,registerNativePush:mock.register,nativeNotificationHref:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/components/UiText',()=>({UiText:({text}:{text:string})=><>{text}</>}));
import {NativePushControls} from './NativePushControls';
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container);mock.register.mockResolvedValue(undefined);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({pushEnabled:true,platforms:{ANDROID:true,IOS:false}})))});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.unstubAllGlobals()});
async function enable(){await act(()=>root.render(<NativePushControls role="client"/>));await act(()=>container.querySelector('button')!.click());return container.querySelector('[role=status]')?.textContent}
it('does not call iPhone push active merely because Android is configured',async()=>{mock.platform='ios';expect(await enable()).toContain('Serviciul de notificări nu este încă activ.')});
it('recognizes the configured platform after registration',async()=>{mock.platform='android';expect(await enable()).toContain('Notificările respectă volumul')});
