// Politica de praguri pentru firme la no-show — spec secțiunea 5b.

export type StrikeConsequence = "warning" | "suspend_7d" | "suspend_permanent";

/**
 * @param strikes30d numărul de strike-uri (no-show) în ultimele 30 de zile, INCLUZÂND cel nou
 * @param strikes90d numărul de strike-uri (no-show) în ultimele 90 de zile, INCLUZÂND cel nou
 */
export function determineConsequence(strikes30d: number, strikes90d: number): StrikeConsequence {
  if (strikes90d >= 3) return "suspend_permanent";
  if (strikes30d >= 2) return "suspend_7d";
  return "warning";
}

/** Pragul (minute) după ora programată în care lipsa confirmării "Am ajuns" devine no-show posibil. */
export const NO_SHOW_GRACE_MINUTES = 45; // mijlocul intervalului 30-60 min recomandat în spec
