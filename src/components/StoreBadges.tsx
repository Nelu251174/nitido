"use client";

import Image from 'next/image';
import {UiText,UiElement,useUiText} from '@/components/UiText';
import { appStoreLinks } from "@/lib/appStore";
import { useAppPlatform } from "@/lib/useAppPlatform";

const GOOGLE_FONT = "'Roboto', 'Helvetica Neue', Arial, sans-serif";

/** Unmodified Apple artwork: the logo and lettering are vector paths. */
export function AppStoreBadge({ className = "" }: { className?: string }) {
  const t = useUiText();
  return (
    <Image src="/store-badges/download-on-the-app-store.svg"
      width={119.66407} height={40} unoptimized
      alt={t("Descărcați de pe App Store")} className={className} />
  );
}

/** Insigna „DESCARCĂ DE PE Google Play". */
export function GooglePlayBadge({ className = "" }: { className?: string }) {
  return (
    <UiElement as="svg"
      viewBox="0 0 135 40"
      className={className}
      role="img"
      aria-label="Descarcă de pe Google Play"
    >
      <rect x=".5" y=".5" width="134" height="39" rx="6.5" fill="#000" stroke="rgba(255,255,255,.5)" />
      <svg x="13" y="9" width="20" height="22" viewBox="0 0 29 32">
        <polygon points="3,3 16.5,16 3,16" fill="#00C853" />
        <polygon points="3,16 16.5,16 3,29" fill="#009E60" />
        <polygon points="3,3 26,16 16.5,16" fill="#FF3B3B" />
        <polygon points="16.5,16 26,16 3,29" fill="#FFC400" />
      </svg>
      <text x="42" y="15.5" fill="#fff" fontFamily={GOOGLE_FONT} fontSize="6.2" letterSpacing="1"><UiText text={"DESCARCĂ DE PE"}/></text>
      <text x="41.5" y="31" fill="#fff" fontFamily={GOOGLE_FONT} fontSize="16" fontWeight={600}><UiText text={"Google Play"}/></text>
    </UiElement>
  );
}

/**
 * Banda „la NITIDO pe telefon" din footer: text + insignele App Store
 * și Google Play. Când linkurile din env sunt setate
 * (NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_PLAY_STORE_URL) insignele devin
 * clicabile; până atunci apar cu eticheta „ÎN CURÂND".
 */
export function PhoneAppPromo() {
  const platform = useAppPlatform();
  if (platform !== "web") return null;

  const links = appStoreLinks();
  const badgeClass = "block h-[46px] w-auto";
  return (
    <div className="border-b border-[#2a332c]">
      <div className="v2-container py-10">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white"><UiText text={"Folosește NITIDO pe telefon"}/></h2>
          {!links.live && (
            <span className="rounded-full border border-[#f5a623] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#f5a623]"><UiText text={"ÎN CURÂND"}/></span>
          )}
        </div>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#8b958f]">
          {links.live
            ? <UiText text={"Folosește linkul disponibil pentru magazinul dispozitivului tău. Poți configura rezervări, consulta lucrările și urmări actualizările din cont. Pentru operațiunile trimise, verifică întotdeauna confirmarea din aplicație."}/>
            : <UiText text={"Poți folosi NITIDO direct din browserul telefonului: configurezi curățenia, intri în cont și urmărești starea lucrărilor. Insignele magazinelor fără link sunt informative și nu descarcă o aplicație. Linkurile de instalare vor fi disponibile aici când publicarea este confirmată."}/>}
        </p>
        <div className="store-badges mt-5 flex flex-wrap items-start gap-6">
          {links.appStore ? (
            <UiElement as="a" className="inline-flex shrink-0 rounded-[7px]" href={links.appStore} aria-label="Descărcați de pe App Store">
              <AppStoreBadge className={badgeClass} />
            </UiElement>
          ) : (
            <AppStoreBadge className={`${badgeClass} opacity-80`} />
          )}
          {links.playStore ? (
            <UiElement as="a" className="inline-flex shrink-0 rounded-[7px]" href={links.playStore} target="_blank" rel="noopener noreferrer" aria-label="Descarcă de pe Google Play">
              <GooglePlayBadge className={badgeClass} />
            </UiElement>
          ) : (
            <span className="inline-flex shrink-0 flex-col items-center gap-1">
              <GooglePlayBadge className={`${badgeClass} opacity-80`} />
              <small className="text-[11px] text-[#f5a623]"><UiText text={"ÎN CURÂND"}/></small>
            </span>
          )}
        </div>
        <p className="mt-4 text-[11px] leading-5 text-[#5f6b63]"><UiText text={"Google Play și sigla Google Play sunt mărci comerciale ale Google LLC. Apple și sigla Apple sunt mărci comerciale ale Apple Inc."}/></p>
      </div>
    </div>
  );
}
