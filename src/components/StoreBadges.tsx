import { appStoreLinks } from "@/lib/appStore";

// Insignele oficiale App Store și Google Play, desenate ca SVG inline (nu ca
// imagini externe) — ca să fie clare pe orice ecran și să nu depindă de fișiere
// încărcate de pe alt server. Respectă designul oficial: fundal negru, marca
// Apple, respectiv triunghiul colorat Google Play.

const APPLE_LOGO =
  "M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z";

const APPLE_FONT = "-apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";
const GOOGLE_FONT = "'Roboto', 'Helvetica Neue', Arial, sans-serif";

/** Insigna „Descărcați de pe App Store" (design oficial Apple, negru). */
export function AppStoreBadge({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 135 40"
      className={className}
      role="img"
      aria-label="Descărcați de pe App Store"
    >
      <rect x=".5" y=".5" width="134" height="39" rx="6.5" fill="#000" stroke="rgba(255,255,255,.5)" />
      <g transform="translate(10 9.5) scale(.82)">
        <path fill="#fff" d={APPLE_LOGO} />
      </g>
      <text x="43" y="16" fill="#fff" fontFamily={APPLE_FONT} fontSize="6.8">
        Descărcați de pe
      </text>
      <text x="42.4" y="31" fill="#fff" fontFamily={APPLE_FONT} fontSize="17" fontWeight={600} letterSpacing="-.5">
        App Store
      </text>
    </svg>
  );
}

/** Insigna „DESCARCĂ DE PE Google Play" (triunghiul colorat oficial). */
export function GooglePlayBadge({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 135 40"
      className={className}
      role="img"
      aria-label="Descarcă de pe Google Play"
    >
      <rect x=".5" y=".5" width="134" height="39" rx="6.5" fill="#000" stroke="rgba(255,255,255,.5)" />
      <svg x="13" y="9" width="20" height="22" viewBox="0 0 29 32">
        <polygon points="3,3 16.5,16 3,16" fill="#00C853" />
        <polygon points="3,16 16.5,16 3,29" fill="#00C3FF" />
        <polygon points="3,3 26,16 16.5,16" fill="#FF3B3B" />
        <polygon points="16.5,16 26,16 3,29" fill="#FFC400" />
      </svg>
      <text x="42" y="15.5" fill="#fff" fontFamily={GOOGLE_FONT} fontSize="6.2" letterSpacing="1">
        DESCARCĂ DE PE
      </text>
      <text x="41.5" y="31" fill="#fff" fontFamily={GOOGLE_FONT} fontSize="16" fontWeight={600}>
        Google Play
      </text>
    </svg>
  );
}

/**
 * Banda „la NITIDO pe telefon" din footer: text + insignele oficiale App Store
 * și Google Play. Când linkurile din env sunt setate
 * (NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_PLAY_STORE_URL) insignele devin
 * clicabile; până atunci apar cu eticheta „ÎN CURÂND".
 */
export function PhoneAppPromo() {
  const links = appStoreLinks();
  const badgeClass = "h-[46px] w-auto";
  return (
    <div className="border-b border-[#2a332c]">
      <div className="v2-container py-10">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">la NITIDO pe telefon</h2>
          {!links.live && (
            <span className="rounded-full border border-[#f5a623] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#f5a623]">
              ÎN CURÂND
            </span>
          )}
        </div>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#8b958f]">
          {links.live
            ? "Descarcă aplicația NITIDO din App Store și Google Play — postezi lucrări și urmărești firmele direct de pe telefon."
            : "Se pregătește pentru App Store și Google Play. Până atunci, folosește NITIDO la fel de bine direct din browserul telefonului."}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {links.appStore ? (
            <a href={links.appStore} target="_blank" rel="noreferrer" aria-label="Descărcați de pe App Store">
              <AppStoreBadge className={badgeClass} />
            </a>
          ) : (
            <AppStoreBadge className={`${badgeClass} opacity-80`} />
          )}
          {links.playStore ? (
            <a href={links.playStore} target="_blank" rel="noreferrer" aria-label="Descarcă de pe Google Play">
              <GooglePlayBadge className={badgeClass} />
            </a>
          ) : (
            <GooglePlayBadge className={`${badgeClass} opacity-80`} />
          )}
        </div>
        <p className="mt-4 text-[11px] leading-5 text-[#5f6b63]">
          Google Play și sigla Google Play sunt mărci comerciale ale Google LLC. Apple și sigla Apple
          sunt mărci comerciale ale Apple Inc.
        </p>
      </div>
    </div>
  );
}
