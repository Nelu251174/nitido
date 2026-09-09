import type { Database } from "better-sqlite3";
import type { SpaceType } from "@/lib/pricing";

/**
 * Opțiunile din „ESTIMATOR LIVE" (calculatorul de preț din pagina principală).
 *
 * Clientul alege un tip și primește un preț informativ. Adminul controlează ce
 * tipuri apar clientului din panoul de administrare (etichetă / vizibil / ordine)
 * — datele reale stau în tabelul `estimator_options`. Lista de mai jos e doar
 * valoarea implicită (folosită la prima pornire și ca rezervă).
 *
 * Prețul se calculează mereu din tariful oficial (calcGrossPrice), deci se
 * potrivește cu prețul real de la postarea lucrării.
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

/** Opțiunile active implicite (fallback fără DB — folosit de teste/SSR de rezervă). */
export function activeEstimatorOptions(): EstimatorOption[] {
  return ESTIMATOR_OPTIONS.filter((o) => o.enabled);
}

// ─── Variantă gestionată de admin (persistată în baza de date) ───────────────

/** Toate opțiunile din DB (inclusiv cele dezactivate), în ordinea de afișare. */
export function getEstimatorOptions(db: Database): EstimatorOption[] {
  const rows = db
    .prepare("SELECT key, label, enabled FROM estimator_options ORDER BY sort_order, key")
    .all() as { key: SpaceType; label: string; enabled: number }[];
  if (!rows.length) return ESTIMATOR_OPTIONS;
  return rows.map((r) => ({ key: r.key, label: r.label, enabled: Boolean(r.enabled) }));
}

/** Doar opțiunile active — ce vede clientul în estimator. */
export function getActiveEstimatorOptions(db: Database): EstimatorOption[] {
  return getEstimatorOptions(db).filter((o) => o.enabled);
}

/** Adminul schimbă eticheta și/sau vizibilitatea unui tip. */
export function updateEstimatorOption(
  db: Database,
  key: SpaceType,
  patch: { label?: string; enabled?: boolean }
): boolean {
  const exists = db.prepare("SELECT key FROM estimator_options WHERE key = ?").get(key);
  if (!exists) return false;
  if (typeof patch.label === "string" && patch.label.trim()) {
    db.prepare("UPDATE estimator_options SET label = ? WHERE key = ?").run(patch.label.trim().slice(0, 40), key);
  }
  if (typeof patch.enabled === "boolean") {
    db.prepare("UPDATE estimator_options SET enabled = ? WHERE key = ?").run(patch.enabled ? 1 : 0, key);
  }
  return true;
}
