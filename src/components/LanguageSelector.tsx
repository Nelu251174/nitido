'use client';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import {useTransition} from 'react';
import {LANGUAGES, LOCALE_COOKIE} from '@/i18n/locales';

export function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <label className="nitido-language-selector">
    <span aria-hidden="true">🌐</span>
    <select aria-label="Language / Limbă" value={locale} disabled={pending} onChange={event => {
      document.cookie = `${LOCALE_COOKIE}=${event.target.value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      startTransition(() => router.refresh());
    }}>
      {LANGUAGES.map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}
    </select>
  </label>;
}
