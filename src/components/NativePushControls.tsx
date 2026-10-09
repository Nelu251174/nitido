'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { PushNotifications } from '@capacitor/push-notifications';
import { nativeNotificationHref, nativePushAvailable, registerNativePush } from '@/lib/nativePushClient';

const subscribeNative = () => () => {};
const serverNative = () => false;
export function NativePushControls({ role, controls = true }: { role: 'client' | 'firma'; controls?: boolean }) {
  const router = useRouter();
  const available = useSyncExternalStore(subscribeNative, nativePushAvailable, serverNative);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    if (!available || controls) return;
    let disposed = false;
    const handle = PushNotifications.addListener('pushNotificationActionPerformed', action => {
      const href = nativeNotificationHref(role, action.notification.data ?? {});
      if (!disposed && href) router.push(href);
    });
    return () => { disposed = true; void handle.then(value => value.remove()); };
  }, [available, controls, role, router]);
  async function enable() {
    setBusy(true);
    try {
      await registerNativePush();
      const status = await fetch('/api/push/status', { cache: 'no-store' });
      if (!status.ok) throw new Error('Nu s-a putut verifica starea notificărilor.');
      const state = await status.json();
      setMessage(state.pushEnabled ? 'Telefon înregistrat. Notificările respectă volumul și modul silențios al telefonului.' : 'Telefon înregistrat. Serviciul de notificări nu este încă activ.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Activarea nu a reușit.'); }
    finally { setBusy(false); }
  }
  if (!available || !controls) return null;
  return <div><button className="web-alert-toggle" disabled={busy} onClick={() => void enable()}>{busy ? 'Se activează…' : 'Activează notificările telefonului'}</button>{message && <p className="web-alert-hint" role="status">{message}</p>}</div>;
}
