import { appStoreLinks } from "@/lib/appStore";

// Butonul „RATING aplicație": invită utilizatorul să evalueze NITIDO în
// magazine. Se activează automat când linkurile din env sunt setate
// (NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_PLAY_STORE_URL). Până atunci afișează
// starea „în curând" — gata de lansare, fără schimbare de cod.
export function AppRatingCard({ compact = false }: { compact?: boolean } = {}) {
  const links = appStoreLinks();
  return (
    <div className={`rounded-2xl border border-line bg-white ${compact ? "p-3.5" : "p-5"}`}>
      <div className="flex items-center gap-1 text-[#f5a623] text-base leading-none" aria-hidden="true">
        ★★★★★
      </div>
      <div className="font-display font-bold text-ink mt-1.5 text-sm">
        Îți place NITIDO? Lasă-ne o notă ⭐
      </div>
      {links.live ? (
        <>
          <p className="text-[12px] text-muted mt-0.5 mb-3">
            O evaluare bună ne ajută enorm să aducem mai multe firme și clienți.
          </p>
          <div className="flex flex-wrap gap-2">
            {links.appStore && (
              <a
                href={links.appStore}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-[130px] text-center rounded-lg bg-ink text-white font-display font-bold text-xs px-4 py-2.5"
              >
                 App Store
              </a>
            )}
            {links.playStore && (
              <a
                href={links.playStore}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-[130px] text-center rounded-lg bg-aqua-deep text-white font-display font-bold text-xs px-4 py-2.5"
              >
                ▶ Google Play
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="text-[12px] text-muted mt-0.5">
          În curând vei putea evalua aplicația în{" "}
          <b className="text-ink">App Store</b> și <b className="text-ink">Google Play</b>.
        </p>
      )}
    </div>
  );
}
