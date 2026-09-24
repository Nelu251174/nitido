export const SERVICES = {
  cleaning_turnover: "Curățenie turnover",
  cleaning_recurring: "Curățenie recurentă",
  property_check: "Verificare proprietate",
  consumables_refill: "Consumabile",
  light_maintenance: "Mentenanță ușoară",
} as const;
export const STATUS: Record<string, string> = {
  draft: "Ciornă",
  scheduled: "Programată",
  offered: "Oferită",
  accepted: "Acceptată",
  in_progress: "În desfășurare",
  submitted_for_review: "Spre verificare",
  rework_requested: "Remediere cerută",
  completed: "Finalizată",
  cancelled: "Anulată",
  pending: "În așteptare",
  approved: "Aprobat",
  not_required: "În mandat",
  rejected: "Respins",
  changes_requested: "Detalii cerute",
  open: "Deschis",
  triaged: "Triat",
  awaiting_quote: "Așteaptă deviz",
  awaiting_approval: "Așteaptă aprobare",
  assigned: "Alocat",
  resolved: "Rezolvat",
  closed: "Închis",
  active: "Activ",
  onboarding: "Configurare",
  paused: "În pauză",
  archived: "Arhivat",
};
export const CHECKLISTS: Record<string, string[]> = {
  cleaning_turnover: [
    "Baie igienizată",
    "Bucătărie igienizată",
    "Suprafețe șterse",
    "Podele curățate",
    "Gunoi eliminat",
    "Pat pregătit conform standard",
    "Prosoape / lenjerie verificate",
    "Consumabile verificate",
    "Electrocasnice verificate vizual",
    "Ferestre / uși verificate",
  ],
  cleaning_recurring: [
    "Baie igienizată",
    "Bucătărie igienizată",
    "Suprafețe șterse",
    "Podele curățate",
    "Gunoi eliminat",
  ],
  property_check: [
    "Uși și ferestre verificate",
    "Stare vizuală verificată",
    "Probleme raportate",
  ],
  consumables_refill: [
    "Inventar verificat",
    "Consumabile completate",
    "Cantități consemnate",
  ],
  light_maintenance: [
    "Sarcina autorizată verificată",
    "Remediere executată",
    "Funcționare verificată",
  ],
};
export function money(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
  }).format(n / 100);
}
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
