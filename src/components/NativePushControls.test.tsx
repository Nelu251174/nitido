// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
const mock=vi.hoisted(()=>({platform:'ios',register:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=>mock.platform}}));
vi.mock('@capacitor/push-notifications',()=>({PushNotifications:{}}));
vi.mock('@/lib/nativePushClient',()=>({nativePushAvailable:()=>true,registerNativePush:mock.register,nativeNotificationHref:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/components/UiText',()=>({UiText:({text}:{text:string})=><>{text}</>}));
import {NativePushControls} from './NativePushControls';
beforeEach(()=>{vi.clearAllMocks();mock.register.mockResolvedValue(undefined);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({pushEnabled:true,platforms:{ANDROID:true,IOS:false}})))});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('does not call iPhone push active merely because Android is configured',async()=>{mock.platform='ios';render(<NativePushControls role="client"/>);fireEvent.click(screen.getByRole('button'));expect((await screen.findByRole('status')).textContent).toContain('Serviciul de notificări nu este încă activ.')});
it('recognizes the configured platform after registration',async()=>{mock.platform='android';render(<NativePushControls role="client"/>);fireEvent.click(screen.getByRole('button'));expect((await screen.findByRole('status')).textContent).toContain('Notificările respectă volumul')});
