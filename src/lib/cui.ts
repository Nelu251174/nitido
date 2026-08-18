/**
 * Verificare CUI (cod unic de înregistrare) pentru firme — spec secțiunea 8:
 * "verificare minimă (CUI valid, contact) înainte de a apărea în alertele
 * către clienți". Până acum era doar declarativ (orice text era acceptat și
 * firma era marcată automat "verificată") — asta se repară aici.
 *
 * Două niveluri:
 * 1. Format — respinge instant orice nu arată a CUI (litere, prea scurt/lung).
 * 2. Verificare reală contra ANAF (webservicesp.anaf.ro, public, fără cheie) —
 *    confirmă că CUI-ul chiar aparține unei firme înregistrate și nu e
 *    radiată. Documentație oficială:
 *    https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/doc_WS_V9.txt
 */

const ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";

/** Curăță un CUI introdus liber de utilizator: scoate "RO", spații, "-". */
export function sanitizeCui(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^RO/, "")
    .replace(/[^\d]/g, "");
}

/** Validare de format — un CUI românesc are între 2 și 10 cifre. Fără rețea. */
export function isPlausibleCui(raw: string): boolean {
  const cui = sanitizeCui(raw);
  return /^\d{2,10}$/.test(cui);
}

export type CuiVerification =
  | { status: "valid"; name: string }
  | { status: "not_found" }
  | { status: "dissolved"; name: string }
  | { status: "unavailable" }; // ANAF nu a putut fi contactat — nu blocăm înregistrarea

/**
 * Interoghează ANAF pentru CUI-ul dat. Nu aruncă — orice eroare de rețea sau
 * răspuns neașteptat devine status "unavailable", ca o eventuală indisponibi-
 * litate temporară a serviciului ANAF să nu blocheze toate înregistrările de
 * firme de pe platformă.
 */
export async function verifyCuiWithAnaf(rawCui: string): Promise<CuiVerification> {
  const cui = Number(sanitizeCui(rawCui));
  if (!cui || Number.isNaN(cui)) return { status: "unavailable" };

  const today = new Date().toISOString().slice(0, 10);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(ANAF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ cui, data: today }]),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { status: "unavailable" };

    const data = (await res.json()) as {
      found?: Array<{
        date_generale?: {
          denumire?: string;
          stare_inregistrare?: string;
          data_radiere?: string | null;
        };
        denumire?: string;
        stare_inregistrare?: string;
        data_radiere?: string | null;
      }>;
      notFound?: unknown[];
      notfound?: unknown[];
    };

    const entry = data.found?.[0];
    if (!entry) return { status: "not_found" };

    const general = entry.date_generale ?? entry;
    const name = general.denumire ?? "firmă înregistrată";
    const dissolved = Boolean(general.data_radiere) ||
      /radia/i.test(general.stare_inregistrare ?? "");

    if (dissolved) return { status: "dissolved", name };
    return { status: "valid", name };
  } catch {
    return { status: "unavailable" };
  }
}
