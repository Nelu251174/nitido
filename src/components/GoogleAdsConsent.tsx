'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { UiText, useUiText } from '@/components/UiText';
import { useAppPlatform } from '@/lib/useAppPlatform';
import { ADS_CONSENT_EVENT, ADS_SETTINGS_EVENT, adsAllowed, initializeGoogleAds, isAdsPublicPath, readAdsConsent, saveAdsConsent, trackAdsPage } from '@/lib/googleAds';

const subscribe = (listener: () => void) => {
  window.addEventListener(ADS_CONSENT_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(ADS_CONSENT_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
};
const snapshot = () => {
  const choice = readAdsConsent();
  return choice === null ? 'unset' : choice.allowed ? 'accepted' : 'refused';
};
const serverSnapshot = () => 'unknown';

export function AdsCookieSettingsButton() {
  const platform = useAppPlatform();
  if (platform !== 'web') return null;
  return <button type="button" className="hover:underline" onClick={() => window.dispatchEvent(new Event(ADS_SETTINGS_EVENT))}><UiText text="Preferințe cookie-uri" /></button>;
}

export function GoogleAdsConsent({ conversionLabel }: { conversionLabel?: string }) {
  const panel=useRef<HTMLElement>(null);
  const platform = useAppPlatform();
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lastPage = useRef<string | null>(null);
  const t = useUiText();
  const eligible = platform === 'web' && isAdsPublicPath(pathname);

  useEffect(() => {
    const show = () => setSettingsOpen(true);
    window.addEventListener(ADS_SETTINGS_EVENT, show);
    return () => window.removeEventListener(ADS_SETTINGS_EVENT, show);
  }, []);

  useEffect(() => {
    if (!eligible) return;
    if (consent !== 'accepted' || !adsAllowed()) {
      lastPage.current = null;
      if (window.nitidoAds?.configured) {
        saveAdsConsent(false);
        window.location.reload();
      }
      return;
    }
    initializeGoogleAds(conversionLabel);
    if (lastPage.current !== pathname) {
      trackAdsPage(pathname);
      lastPage.current = pathname;
    }
  }, [eligible, consent, pathname, conversionLabel]);

  useEffect(()=>{if(settingsOpen){panel.current?.scrollIntoView({block:'start'});panel.current?.querySelector('button')?.focus();}},[settingsOpen]);
  if (!eligible || !(settingsOpen || consent === 'unset')) return null;
  function choose(accept: boolean) {
    const reload = !accept && Boolean(window.nitidoAds?.configured);
    saveAdsConsent(accept);
    setSettingsOpen(false);
    // A new document unloads an already loaded third-party library on withdrawal.
    if (reload) window.location.reload();
  }
  return <section ref={panel} className="nitido-cookie-consent" aria-label={t('Preferințe cookie-uri')}>
    <h2><UiText text="Cookie-uri publicitare" /></h2>
    <p><UiText text="Cu acordul tău, folosim cookie-uri publicitare pentru măsurarea reclamelor. Poți refuza și continua rezervarea." />{' '}<a href="/cookie-uri"><UiText text="Detalii despre cookie-uri" /></a></p>
    <div><button type="button" onClick={() => choose(false)}><UiText text="Refuz cookie-urile publicitare" /></button><button type="button" onClick={() => choose(true)}><UiText text="Accept cookie-urile publicitare" /></button></div>
  </section>;
}
