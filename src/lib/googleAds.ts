import { Capacitor } from '@capacitor/core';

export const GOOGLE_ADS_ID = 'AW-18344130112';
export const ADS_CONSENT_KEY = 'nitido.ads-consent.v1';
export const ADS_CONSENT_EVENT = 'nitido:ads-consent';
export const ADS_SETTINGS_EVENT = 'nitido:ads-settings';
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
type Choice = { allowed: boolean; savedAt: number };
type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    nitidoAds?: { configured: boolean; sendTo: string | null };
  }
}

export function readAdsConsent(now = Date.now()): Choice | null {
  try {
    const value = JSON.parse(localStorage.getItem(ADS_CONSENT_KEY) || 'null');
    return value && typeof value.allowed === 'boolean' && Number.isFinite(value.savedAt)
      && value.savedAt <= now && now - value.savedAt < MAX_AGE ? value : null;
  } catch { return null; }
}

export function adsAllowed(): boolean {
  return typeof window !== 'undefined' && Capacitor.getPlatform() === 'web'
    && ['nitido.ro', 'www.nitido.ro'].includes(window.location.hostname)
    && readAdsConsent()?.allowed === true;
}

export function isAdsPublicPath(path: string): boolean {
  return ['/', '/rezervare', '/signup', '/pentru-firme', '/inscrie-firma', '/cookie-uri', '/confidentialitate', '/termeni', '/despre-noi', '/contact', '/cum-functioneaza', '/pentru-clienti', '/preturi', '/incredere', '/siguranta', '/cariere'].includes(path) || path.startsWith('/curatenie/');
}

const denied = { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };

/** Queue consent defaults before any config or measurement. No network before acceptance. */
export function initializeGoogleAds(label?: string): void {
  if (!adsAllowed()) return;
  if (!window.nitidoAds) {
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line prefer-rest-params -- Preserve Google's documented IArguments queue format.
    window.gtag = window.gtag || function () { window.dataLayer!.push(arguments); };
    window.gtag('consent', 'default', denied);
    window.gtag('set', 'ads_data_redaction', true);
    window.gtag('consent', 'update', { ...denied, ad_storage: 'granted', ad_user_data: 'granted' });
    window.gtag('js', new Date());
    window.nitidoAds = { configured: false, sendTo: null };
  }
  window.nitidoAds.sendTo = label && /^[A-Za-z0-9_-]+$/.test(label) ? `${GOOGLE_ADS_ID}/${label}` : null;
  if (!window.nitidoAds.configured) {
    window.gtag!('config', GOOGLE_ADS_ID, { send_page_view: false, allow_ad_personalization_signals: false, allow_enhanced_conversions: false, page_location: adsPageLocation(), page_referrer: '', page_title: 'NITIDO' });
    window.nitidoAds.configured = true;
    if (!document.getElementById('nitido-google-ads')) {
      const script = document.createElement('script');
      script.id = 'nitido-google-ads';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
      document.head.appendChild(script);
    }
  }
}

/** Never forward account data or arbitrary query strings to Google. */
export function adsPageLocation(): string {
  const url = new URL(window.location.href);
  const clean = new URL(url.pathname, url.origin);
  for (const key of ['gclid', 'gbraid', 'wbraid']) {
    const value = url.searchParams.get(key);
    if (value && /^[A-Za-z0-9_.-]{1,500}$/.test(value)) clean.searchParams.set(key, value);
  }
  return clean.href;
}

export function trackAdsPage(path: string): void {
  if (!adsAllowed() || !isAdsPublicPath(path) || !window.nitidoAds?.configured) return;
  window.gtag?.('event', 'page_view', { send_to: GOOGLE_ADS_ID, page_location: adsPageLocation(), page_title: 'NITIDO', page_referrer: '' });
}

/** Called only by the successful firm-signup response; dormant without the Ads label. */
export function trackCompanySignup(role: string): boolean {
  if (role !== 'firma' || !adsAllowed() || !window.nitidoAds?.sendTo) return false;
  window.gtag?.('event', 'conversion', {
    send_to: window.nitidoAds.sendTo, transaction_id: crypto.randomUUID(),
    page_location: adsPageLocation(), page_title: 'NITIDO', page_referrer: '',
  });
  return true;
}

export function saveAdsConsent(allowed: boolean): void {
  try { localStorage.setItem(ADS_CONSENT_KEY, JSON.stringify({ allowed, savedAt: Date.now() })); } catch { /* Refusal remains effective when storage is unavailable. */ }
  if (!allowed) {
    window.gtag?.('consent', 'update', denied);
    window.nitidoAds = undefined;
    // Only Google Ads first-party cookies; leave authentication and preferences intact.
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0].trim();
      if (!name.startsWith('_gcl_')) continue;
      for (const domain of ['', 'nitido.ro', '.nitido.ro', window.location.hostname]) {
        document.cookie = `${name}=; Max-Age=0; Path=/;${domain ? ` Domain=${domain};` : ''} SameSite=Lax; Secure`;
      }
    }
  }
  window.dispatchEvent(new Event(ADS_CONSENT_EVENT));
}
