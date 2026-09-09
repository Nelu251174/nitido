// Linkuri către magazinele de aplicații (App Store / Google Play) pentru
// butonul de evaluare („RATING aplicație"). Configurate din env public, ca să
// se activeze automat când aplicația e publicată — fără schimbare de cod.
//
// Setează în producție:
//   NEXT_PUBLIC_APP_STORE_URL = https://apps.apple.com/...
//   NEXT_PUBLIC_PLAY_STORE_URL = https://play.google.com/store/apps/details?id=...
//
// Cât timp nu sunt setate, butonul afișează starea „în curând" (pre-lansare).

export interface AppStoreLinks {
  appStore: string | null;
  playStore: string | null;
  /** true dacă cel puțin un magazin e configurat (aplicația e publicată). */
  live: boolean;
}

export function resolveAppStoreLinks(
  appStoreUrl?: string | null,
  playStoreUrl?: string | null
): AppStoreLinks {
  const appStore = appStoreUrl && appStoreUrl.trim() ? appStoreUrl.trim() : null;
  const playStore = playStoreUrl && playStoreUrl.trim() ? playStoreUrl.trim() : null;
  return { appStore, playStore, live: Boolean(appStore || playStore) };
}

/** Linkurile din env public (inline la build de Next). */
export function appStoreLinks(): AppStoreLinks {
  return resolveAppStoreLinks(
    process.env.NEXT_PUBLIC_APP_STORE_URL,
    process.env.NEXT_PUBLIC_PLAY_STORE_URL
  );
}
