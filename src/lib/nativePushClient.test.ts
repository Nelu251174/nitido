import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ native: true, listeners: new Map<string, (x: unknown) => void>(), remove: vi.fn(), permission: vi.fn(), unregister: vi.fn(), clear: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mock.native, isPluginAvailable: () => true, getPlatform: () => 'ios' } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {
  requestPermissions: mock.permission,
  addListener: async (event: string, cb: (x: unknown) => void) => { mock.listeners.set(event, cb); return { remove: mock.remove }; },
  register: async () => { mock.listeners.get('registration')?.({ value: 'test-native-token-only' }); },
  unregister: mock.unregister, removeAllDeliveredNotifications: mock.clear,
} }));
import { logoutWithNativePush, nativeNotificationHref, registerNativePush } from './nativePushClient';
const storage = new Map<string, string>();
beforeEach(() => {
  vi.clearAllMocks(); storage.clear(); mock.native = true; mock.listeners.clear();
  mock.permission.mockResolvedValue({ receive: 'granted' });
  mock.unregister.mockResolvedValue(undefined); mock.clear.mockResolvedValue(undefined);
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('native app notification integration', () => {
  it('opens the assigned appointment without accepting a payload-supplied destination', () => {
    expect(nativeNotificationHref('firma', {event_type:'APPOINTMENT_REMINDER',job_id:'a/b?x=1',path:'https://example.invalid'})).toBe('/firma/programari?jobId=a%2Fb%3Fx%3D1');
  });
  it('rejects reminder destinations for other roles or invalid job identities', () => {
    expect(nativeNotificationHref('client', {event_type:'APPOINTMENT_REMINDER',job_id:'j1'})).toBeNull();
    expect(nativeNotificationHref('firma', {event_type:'APPOINTMENT_REMINDER',job_id:''})).toBeNull();
    expect(nativeNotificationHref('firma', {event_type:'APPOINTMENT_REMINDER',job_id:'x'.repeat(201)})).toBeNull();
  });
  it('registers the native token only after permission and persists only after server acceptance', async () => {
    const request = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', request);
    await registerNativePush();
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ platform: 'IOS', deviceToken: 'test-native-token-only' });
    expect(storage.get('nitido.native-push.v1')).toBe('test-native-token-only');
    expect(mock.remove).toHaveBeenCalledTimes(2);
  });
  it('does not pretend that registration succeeded when another account owns the token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 409 })));
    await expect(registerNativePush()).rejects.toThrow('altui cont');
    expect(storage.size).toBe(0); expect(mock.remove).toHaveBeenCalledTimes(2);
  });
  it('does not contact the server after notification permission refusal', async () => {
    mock.permission.mockResolvedValue({ receive: 'denied' }); const request = vi.fn(); vi.stubGlobal('fetch', request);
    await expect(registerNativePush()).rejects.toThrow('Permite notificările'); expect(request).not.toHaveBeenCalled();
  });
  it('revokes push before logging out and clears delivered notifications', async () => {
    storage.set('nitido.native-push.v1', 'old-token'); const request = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', request);
    await logoutWithNativePush(); expect(request.mock.calls.map(call => call[0])).toEqual(['/api/push/unregister', '/api/auth/logout']);
    expect(storage.size).toBe(0); expect(mock.unregister).toHaveBeenCalledOnce(); expect(mock.clear).toHaveBeenCalledOnce();
  });
  it('keeps the session and retry token when revocation fails', async () => {
    storage.set('nitido.native-push.v1', 'old-token'); const request = vi.fn().mockResolvedValue(new Response('{}', { status: 503 })); vi.stubGlobal('fetch', request);
    await expect(logoutWithNativePush()).rejects.toThrow('Reîncearcă');
    expect(request).toHaveBeenCalledTimes(1); expect(storage.get('nitido.native-push.v1')).toBe('old-token');
  });
  it('logs out after server revocation even when the native unregister method rejects', async () => {
    storage.set('nitido.native-push.v1','old-token');
    mock.unregister.mockRejectedValueOnce(new Error('native method unavailable'));
    const request=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',request);
    await expect(logoutWithNativePush()).resolves.toBeUndefined();
    expect(request.mock.calls.map(call=>call[0])).toEqual(['/api/push/unregister','/api/auth/logout']);
    expect(storage.size).toBe(0);expect(mock.clear).toHaveBeenCalledOnce();
  });
  it('does not keep the account logged in when clearing delivered notifications rejects', async () => {
    storage.set('nitido.native-push.v1','old-token');mock.clear.mockRejectedValueOnce(new Error('OS error'));
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));
    await expect(logoutWithNativePush()).resolves.toBeUndefined();expect(storage.size).toBe(0);
  });
  it('bounds native cleanup after the server has already confirmed logout', async () => {
    vi.useFakeTimers();storage.set('nitido.native-push.v1','old-token');
    mock.unregister.mockImplementationOnce(()=>new Promise(()=>{}));
    const request=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',request);
    const pending=logoutWithNativePush();await vi.advanceTimersByTimeAsync(1500);await pending;
    expect(request).toHaveBeenCalledTimes(2);expect(storage.size).toBe(0);
  });
  it('keeps the token for retry and avoids local cleanup when session deletion is not confirmed', async () => {
    storage.set('nitido.native-push.v1','old-token');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('{}',{status:503})));
    await expect(logoutWithNativePush()).rejects.toThrow('Reîncearcă');
    expect(storage.get('nitido.native-push.v1')).toBe('old-token');expect(mock.unregister).not.toHaveBeenCalled();
  });
  it('deduplicates rapid clicks into one server logout', async () => {
    mock.native=false;let resolve!: (value:Response)=>void;
    const request=vi.fn().mockImplementation(()=>new Promise<Response>(r=>{resolve=r}));vi.stubGlobal('fetch',request);
    const first=logoutWithNativePush(),second=logoutWithNativePush();expect(first).toBe(second);
    resolve(new Response('{}'));await Promise.all([first,second]);expect(request).toHaveBeenCalledOnce();
  });
  it('aborts a stalled server request and lets the user retry instead of waiting indefinitely', async () => {
    vi.useFakeTimers();mock.native=false;
    vi.stubGlobal('fetch',vi.fn().mockImplementation((_url,init)=>new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new Error('aborted')))})));
    const pending=expect(logoutWithNativePush()).rejects.toThrow('Reîncearcă');
    await vi.advanceTimersByTimeAsync(10000);await pending;
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));await expect(logoutWithNativePush()).resolves.toBeUndefined();
  });
  it('still logs out when an in-flight push registration fails', async () => {
    mock.permission.mockRejectedValueOnce(new Error('permission interrupted'));
    const registration=registerNativePush().catch(()=>undefined);
    const request=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',request);
    await logoutWithNativePush();await registration;expect(request.mock.calls.map(call=>call[0])).toEqual(['/api/auth/logout']);
  });
  it('leaves normal browser logout on its existing endpoint', async () => {
    mock.native = false; const request = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', request);
    await logoutWithNativePush(); expect(request.mock.calls.map(call => call[0])).toEqual(['/api/auth/logout']);
  });
  it('builds only role-appropriate internal destinations from notifications', () => {
    expect(nativeNotificationHref('client', { event_type: 'JOB_COMPLETED', job_id: 'a/b' })).toBe('/client?job=a%2Fb');
    expect(nativeNotificationHref('firma', { event_type: 'MESSAGE_RECEIVED', job_id: 'j1' })).toBe('/firma/mesaje?job=j1');
    expect(nativeNotificationHref('firma', { event_type: 'JOB_COMPLETED', job_id: 'j1' })).toBeNull();
    expect(nativeNotificationHref('admin', { event_type: 'MESSAGE_RECEIVED', job_id: 'j1' })).toBeNull();
    expect(nativeNotificationHref('client', { event_type: 'UNKNOWN', job_id: 'j1' })).toBeNull();
  });
});
