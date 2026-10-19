// Linkuri către magazinele de aplicații (App Store / Google Play) pentru
// butonul de evaluare („RATING aplicație"). Configurate din env public, ca să
// se activeze automat când aplicația e publicată — fără schimbare de cod.
//
// Setează în producție:
//   NEXT_PUBLIC_APP_STORE_URL = https://apps.apple.com/...
//   NEXT_PUBLIC_PLAY_STORE_URL = https://play.google.com/store/apps/details?id=...
//
// Published store pages stay available when no deployment override is set.
export const PUBLISHED_APP_STORE_URL = "https://apps.apple.com/app/id6810752486";
export const PUBLISHED_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ro.nitido.app";

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
    process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || PUBLISHED_APP_STORE_URL,
    process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() || PUBLISHED_PLAY_STORE_URL
  );
}

/** Native rating links must only point to the current device's store. */
export function storeLinksForPlatform(
  links: AppStoreLinks,
  platform: "web" | "ios" | "android" | "unknown"
): AppStoreLinks {
  return resolveAppStoreLinks(
    platform === "web" || platform === "ios" ? links.appStore : null,
    platform === "web" || platform === "android" ? links.playStore : null
  );
}
