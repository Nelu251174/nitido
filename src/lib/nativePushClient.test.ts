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
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());
describe('existing TestFlight app notification integration', () => {
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
