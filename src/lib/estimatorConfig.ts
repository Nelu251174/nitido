import type { SpaceType } from "@/lib/pricing";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  OPȚIUNILE din „ESTIMATOR LIVE" (calculatorul de preț din pagina principală)
 *  ACESTA E SINGURUL LOC de modificat pentru tipurile din estimator.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Ca să schimbi ce apare în calculator, editează lista de mai jos:
 *    • label    = textul de pe buton — îl poți schimba liber
 *                 (ex: „Casă" → „Vilă", „Birou" → „Birou / Office")
 *    • enabled  = true  → apare în calculator
 *                 false → e ascuns (nu-l ștergi, doar îl stingi)
 *    • ordinea  = ordinea din listă = ordinea butoanelor
 *
 *  Prețul se calculează automat și corect din tariful oficial
 *  (calcGrossPrice), deci NU trebuie atins aici — se potrivește mereu
 *  cu prețul real de la postarea lucrării.
 *
 *  Notă: `key` trebuie să rămână unul dintre tipurile recunoscute de tarif:
 *  apartament · casa · birou · altul. (Pentru un tip complet nou, cu tarif
 *  propriu, spune-mi și îl adaug și în regulile de preț.)
 */

export interface EstimatorOption {
  key: SpaceType;
  label: string;
  enabled: boolean;
}

export const ESTIMATOR_OPTIONS: EstimatorOption[] = [
  { key: "apartament", label: "Apartament", enabled: true },
  { key: "casa",       label: "Casă / Vilă", enabled: true },
  { key: "birou",      label: "Birou",       enabled: true },
  { key: "altul",      label: "Altul",       enabled: true },
];

/** Opțiunile active, în ordinea de afișare. */
export function activeEstimatorOptions(): EstimatorOption[] {
  return ESTIMATOR_OPTIONS.filter((o) => o.enabled);
}
