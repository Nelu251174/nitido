import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const tokenKey = 'nitido.native-push.v1';
let registration: Promise<void> | null = null;
export const nativePushAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');

export function nativeNotificationHref(role: string, data: Record<string, unknown>): string | null {
  if (!['client', 'firma'].includes(role) || typeof data.job_id !== 'string' || !data.job_id || data.job_id.length > 200) return null;
  const id = encodeURIComponent(data.job_id);
  if (data.event_type === 'MESSAGE_RECEIVED') return `/${role}/mesaje?job=${id}`;
  if (role === 'client' && ['JOB_ACCEPTED', 'JOB_ARRIVED', 'JOB_COMPLETED'].includes(String(data.event_type))) return `/client?job=${id}`;
  if (role === 'firma' && data.event_type === 'JOB_CREATED') return '/firma';
  return null;
}

export function registerNativePush(): Promise<void> {
  if (registration) return registration;
  registration = register().finally(() => { registration = null; });
  return registration;
}

async function register() {
  if (!nativePushAvailable()) throw new Error('Actualizează aplicația pentru notificări.');
  if (Capacitor.getPlatform() === 'android') {
    for (const [id, name] of [['messages-v1', 'Mesaje NITIDO'], ['activity-v1', 'Activitatea lucrărilor']]) {
      await PushNotifications.createChannel({ id, name, importance: 4, vibration: true });
    }
  }
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') throw new Error('Permite notificările pentru NITIDO din setările telefonului.');
  const handles: Array<{ remove(): Promise<void> }> = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = await new Promise<string>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Înregistrarea a durat prea mult. Reîncearcă.')), 20000);
      void (async () => {
        handles.push(await PushNotifications.addListener('registration', value => resolve(value.value)));
        handles.push(await PushNotifications.addListener('registrationError', () => reject(new Error('Telefonul nu a putut activa notificările.'))));
        await PushNotifications.register();
      })().catch(reject);
    });
    const previous = localStorage.getItem(tokenKey);
    if (previous && previous !== token) {
      const revoked = await fetch('/api/push/unregister', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceToken: previous }) });
      if (!revoked.ok) throw new Error('Nu s-a putut actualiza înregistrarea telefonului.');
    }
    const response = await fetch('/api/push/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: Capacitor.getPlatform() === 'ios' ? 'IOS' : 'ANDROID', deviceToken: token }) });
    if (!response.ok) throw new Error(response.status === 409 ? 'Telefonul este asociat altui cont. Dezactivează notificările din acel cont înainte de schimbare.' : 'Înregistrarea telefonului nu a fost confirmată.');
    localStorage.setItem(tokenKey, token);
  } finally {
    clearTimeout(timer);
    await Promise.all(handles.map(handle => handle.remove()));
  }
}

export async function logoutWithNativePush() {
  if (nativePushAvailable()) {
    if (registration) await registration;
    const token = localStorage.getItem(tokenKey);
    if (token) {
      const response = await fetch('/api/push/unregister', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceToken: token }) });
      if (!response.ok) throw new Error('Nu s-au putut opri notificările. Reîncearcă ieșirea din cont.');
      await PushNotifications.unregister();
      await PushNotifications.removeAllDeliveredNotifications();
      localStorage.removeItem(tokenKey);
    }
  }
  const response = await fetch('/api/auth/logout', { method: 'POST' });
  if (!response.ok) throw new Error('Ieșirea din cont nu a reușit. Reîncearcă.');
}
