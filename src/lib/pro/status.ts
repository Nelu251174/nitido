export const PRO_STATUSES = [
  "noua","in_evaluare","planificata","alocata","acceptata","in_desfasurare","raportata","necesita_clarificare","aprobata","inchisa","anulata",
] as const;
export type ProStatus = (typeof PRO_STATUSES)[number];
const ALLOWED: Record<ProStatus, ProStatus[]> = {
  noua: ["in_evaluare", "anulata"],
  in_evaluare: ["planificata", "anulata"],
  planificata: ["alocata", "anulata"],
  alocata: ["acceptata", "planificata", "anulata"],
  acceptata: ["in_desfasurare", "anulata"],
  in_desfasurare: ["raportata", "anulata"],
  raportata: ["necesita_clarificare", "aprobata", "anulata"],
  necesita_clarificare: ["raportata", "anulata"],
  aprobata: ["inchisa", "anulata"],
  inchisa: [],
  anulata: [],
};
export function canTransition(from: ProStatus, to: ProStatus): boolean {
  return ALLOWED[from].includes(to);
}
