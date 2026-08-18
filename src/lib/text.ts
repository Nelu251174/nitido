/**
 * Normalizează un nume de oraș pentru comparație — elimină diacritice, spații
 * de la capete și diferențele de majuscule/minuscule.
 *
 * De ce există: orașul e introdus ca text liber, atât la postarea unei lucrări
 * (Client) cât și la zona de acoperire (Firmă). Fără normalizare, "Constanța"
 * (Client) și "constanta" / "Constanta " (Firmă) nu se potrivesc la o comparație
 * exactă de șiruri, deși sunt evident același oraș — firma nu mai primește
 * alerta pentru lucrarea respectivă. Vezi folosirea în /api/jobs (GET, filtrare
 * după oraș) și /api/firms.
 */
export function normalizeCity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Curăță textul liber introdus de o firmă pentru "alte localități acoperite"
 * (listă separată prin virgulă) — elimină intrările goale și spațiile în
 * plus, păstrează forma originală (cu diacritice) pentru afișare; potrivirea
 * efectivă cu o lucrare se face tot prin normalizeCity, la citire.
 */
export function sanitizeCoverageCitiesInput(raw: string): string {
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Verifică dacă o firmă (cu zona ei principală + eventuale localități extra)
 * acoperă orașul unei lucrări — indiferent de diacritice/majuscule/spații.
 * Zona principală (coverage_city) e obligatorie; cele extra sunt opționale,
 * introduse liber la înregistrare ("Ovidiu, Mamaia, Năvodari") pentru firme
 * care lucrează și în afara orașului lor de bază.
 */
export function firmCoversCity(
  coverageCity: string,
  coverageCitiesExtra: string | null | undefined,
  jobCity: string
): boolean {
  const target = normalizeCity(jobCity);
  if (normalizeCity(coverageCity) === target) return true;
  if (!coverageCitiesExtra) return false;
  return coverageCitiesExtra
    .split(",")
    .map((c) => normalizeCity(c))
    .filter(Boolean)
    .includes(target);
}
