import {beforeEach,expect,it,vi} from 'vitest';
import type {NotificationResponse} from 'expo-notifications';
const mock=vi.hoisted(()=>({
 api:vi.fn(),get:vi.fn(),set:vi.fn(),forget:vi.fn(),permissions:vi.fn(),request:vi.fn(),token:vi.fn(),channel:vi.fn(),handler:vi.fn(),clear:vi.fn(),remove:vi.fn(),navigate:vi.fn(),
 platform:{OS:'ios'},last:null as NotificationResponse|null,listener:null as ((r:NotificationResponse)=>void)|null,cleanup:undefined as (()=>void)|undefined,
}));
vi.mock('react',()=>({useEffect:(effect:()=>()=>void)=>{mock.cleanup=effect();}}));
vi.mock('react-native',()=>({Platform:mock.platform}));
vi.mock('expo-router',()=>({router:{push:mock.navigate}}));
vi.mock('expo-device',()=>({isDevice:true}));
vi.mock('expo-secure-store',()=>({getItemAsync:mock.get,setItemAsync:mock.set,deleteItemAsync:mock.forget}));
vi.mock('./api',()=>({api:mock.api}));
vi.mock('expo-notifications',()=>({
 getPermissionsAsync:mock.permissions,requestPermissionsAsync:mock.request,getDevicePushTokenAsync:mock.token,setNotificationChannelAsync:mock.channel,setNotificationHandler:mock.handler,AndroidImportance:{DEFAULT:3,HIGH:4},
 getLastNotificationResponse:()=>mock.last,clearLastNotificationResponse:mock.clear,
 addNotificationResponseReceivedListener:(callback:(r:NotificationResponse)=>void)=>{mock.listener=callback;return {remove:mock.remove};},
}));
beforeEach(()=>{
 vi.resetModules();vi.resetAllMocks();mock.platform.OS='ios';mock.last=null;mock.listener=null;mock.cleanup=undefined;
 mock.get.mockResolvedValue('previous-token');mock.api.mockResolvedValue({ok:true});mock.permissions.mockResolvedValue({status:'granted'});mock.request.mockResolvedValue({status:'granted'});mock.token.mockResolvedValue({data:'current-token'});
});
const response=(event='JOB_CREATED',jobId='job:42')=>({actionIdentifier:'default',notification:{date:0,request:{identifier:'notification-1',trigger:{type:'push'},content:{title:null,subtitle:null,body:null,categoryIdentifier:null,sound:null,data:{event_type:event,job_id:jobId}}}}}) as NotificationResponse;
it('native entrypoint exposes current device settings used by the notifications screen',async()=>{
 const native=await import('./push.native');expect(await native.currentPushSettings()).toEqual({registeredLocally:true,permissionGranted:true});
 const generic=await import('./push');expect(generic.currentPushSettings).toBe(native.currentPushSettings);
});
it('never saves registration when the server did not confirm it',async()=>{
 const native=await import('./push.native');mock.api.mockResolvedValue({ok:false});await expect(native.registerPush()).rejects.toThrow('confirmat');expect(mock.set).not.toHaveBeenCalled();
});
it('registers the actual native token with the correct platform',async()=>{
 const native=await import('./push.native');expect(await native.registerPush()).toBe(true);
 expect(mock.api).toHaveBeenCalledWith('/api/push/register',{method:'POST',body:JSON.stringify({platform:'IOS',deviceToken:'current-token'})});expect(mock.set).toHaveBeenCalledWith('nitido.push-token.v1','current-token');
});
it('prepares the Android channel before asking for notification permission',async()=>{
 mock.platform.OS='android';const native=await import('./push.native');await native.registerPush();expect(mock.channel.mock.invocationCallOrder[0]).toBeLessThan(mock.request.mock.invocationCallOrder[0]);expect(JSON.parse(mock.api.mock.calls[0][1].body).platform).toBe('ANDROID');
});
it('permission refusal does not register or persist a token',async()=>{
 mock.request.mockResolvedValue({status:'denied'});const native=await import('./push.native');expect(await native.registerPush()).toBe(false);expect(mock.api).not.toHaveBeenCalled();expect(mock.set).not.toHaveBeenCalled();
});
it.each([new Error('offline'),{ok:false}])('keeps local revocation retryable on server failure: %s',async failure=>{
 if(failure instanceof Error)mock.api.mockRejectedValue(failure);else mock.api.mockResolvedValue(failure);
 const native=await import('./push.native');await expect(native.unregisterCurrentPush()).rejects.toThrow();expect(mock.forget).not.toHaveBeenCalled();
});
it('forgets only the current registration after server confirmation',async()=>{
 const native=await import('./push.native');await native.unregisterCurrentPush();expect(mock.api).toHaveBeenCalledWith('/api/push/unregister',{method:'POST',body:JSON.stringify({deviceToken:'previous-token'})});expect(mock.forget).toHaveBeenCalledOnce();
});
it('rotation stops when the old token revocation is unconfirmed',async()=>{
 mock.api.mockResolvedValue({ok:false});const native=await import('./push.native');await expect(native.refreshRegisteredPushToken()).rejects.toThrow();expect(mock.api).toHaveBeenCalledOnce();expect(mock.set).not.toHaveBeenCalled();
});
it('rotation retains the previous token until the replacement is acknowledged',async()=>{
 mock.api.mockResolvedValueOnce({ok:true}).mockResolvedValueOnce({ok:false});const native=await import('./push.native');await expect(native.refreshRegisteredPushToken()).rejects.toThrow('confirmat');expect(mock.set).not.toHaveBeenCalled();
 mock.api.mockResolvedValue({ok:true});expect(await native.refreshRegisteredPushToken()).toBe(true);expect(mock.set).toHaveBeenCalledWith('nitido.push-token.v1','current-token');
});
it('opens a cold-start notification once after login and cleans up the listener',async()=>{
 mock.get.mockResolvedValue(null);mock.last=response();const native=await import('./push.native');native.useNotificationRouting(null);expect(mock.navigate).toHaveBeenCalledWith('/(auth)/login');mock.cleanup?.();expect(mock.remove).toHaveBeenCalledOnce();
 native.useNotificationRouting('firma');expect(mock.navigate.mock.calls.map(call=>call[0])).toEqual(['/(auth)/login','/(firma)/job-preview/job%3A42']);mock.listener?.(mock.last);expect(mock.navigate).toHaveBeenCalledTimes(2);
});
it('ignores unknown events and events for the other role',async()=>{
 mock.get.mockResolvedValue(null);const native=await import('./push.native');native.useNotificationRouting('client');mock.listener?.(response('MALICIOUS','https://outside'));mock.listener?.(response());expect(mock.navigate).not.toHaveBeenCalled();
});
it('web settings expose a truthful unsupported-device state without native registration',async()=>{
 const web=await import('./push.web');expect(await web.currentPushSettings()).toEqual({registeredLocally:false,permissionGranted:false});expect(await web.registerPush()).toBe(false);expect(mock.api).not.toHaveBeenCalled();
});

it('plays sound once for a new message and suppresses duplicate deliveries',async()=>{
 mock.get.mockResolvedValue(null);const native=await import('./push.native');native.useNotificationRouting('firma');
 const handler=mock.handler.mock.calls[0][0].handleNotification;
 const notification=response('MESSAGE_RECEIVED').notification;
 expect(await handler(notification)).toMatchObject({shouldPlaySound:true,shouldShowBanner:true});
 expect(await handler(notification)).toMatchObject({shouldPlaySound:false,shouldShowBanner:false});
 mock.listener?.(response('MESSAGE_RECEIVED'));
 expect(mock.navigate).toHaveBeenCalledWith('/(firma)/messages?jobId=job%3A42');
});
it('creates an audible Android message channel',async()=>{
 mock.platform.OS='android';const native=await import('./push.native');await native.registerPush();
 expect(mock.channel).toHaveBeenCalledWith('messages-v1',expect.objectContaining({sound:'default',importance:4,enableVibrate:true}));
});
