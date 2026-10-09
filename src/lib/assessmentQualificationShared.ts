export const QUALIFICATION_OUTCOMES = {
  pending: 'Pregătire încă neverificată sau incompletă',
  ready: 'Criteriile planului erau îndeplinite la verificare',
  unavailable: 'Capacitate indisponibilă pentru planul verificat',
  legacy_unknown: 'Cerere istorică fără jurnal prospectiv',
} as const;
export type QualificationOutcome = 'pending' | 'ready' | 'unavailable';
export type EffectiveQualificationOutcome = QualificationOutcome | 'legacy_unknown';
export const QUALIFICATION_BASIS = 'Pregătire operațională pentru planul verificat; nu eligibilitate comercială, rezervare de capacitate sau permisiune de ofertare/alocare.';
