export const SCORE_COMPONENTS = {
  rating: 'Rating verificat',
  punctuality: 'Sosiri până la ora programată',
  reliability: 'Alocări fără no-show',
  complaintFree: 'Lucrări fără reclamație confirmată',
  evidence: 'Fotografii obligatorii validate',
} as const;
export type ScoreComponent = keyof typeof SCORE_COMPONENTS;
export type ScorePolicy = {
  mode: 'observation';
  periodDays: number;
  minimumCompletedJobs: number;
  minimumSamples: number;
  weights: Record<ScoreComponent, number>;
};
export type ScoreMeasurement = { percent: number | null; samples: number };
export type ScoreInputs = {
  completedJobs: number;
  measurements: Record<ScoreComponent, ScoreMeasurement>;
};
export type ScoreObservation = {
  score: number | null;
  reasons: string[];
  components: { key: ScoreComponent; label: string; percent: number | null; samples: number; weight: number; contribution: number | null }[];
  automaticAllocation: false;
};
// No default weights, missing-data substitution or redistribution of weights.
export function evaluateProviderScore(policy: ScorePolicy, input: ScoreInputs): ScoreObservation {
  const reasons: string[] = [];
  if (!Number.isSafeInteger(input.completedJobs) || input.completedJobs < policy.minimumCompletedJobs)
    reasons.push('Volum de lucrări finalizate insuficient pentru această regulă.');
  const components = (Object.keys(SCORE_COMPONENTS) as ScoreComponent[]).filter(key => policy.weights[key] > 0).map(key => {
    const measurement = input.measurements[key];
    const valid = Number.isSafeInteger(measurement.samples) && measurement.samples >= policy.minimumSamples && measurement.percent !== null && Number.isFinite(measurement.percent) && measurement.percent >= 0 && measurement.percent <= 100;
    if (!valid) reasons.push(`${SCORE_COMPONENTS[key]}: date insuficiente.`);
    return { key, label: SCORE_COMPONENTS[key], percent: valid ? measurement.percent : null, samples: measurement.samples, weight: policy.weights[key], contribution: valid ? measurement.percent! * policy.weights[key] / 100 : null };
  });
  return { score: reasons.length ? null : Math.round(components.reduce((sum, component) => sum + component.contribution!, 0) * 100) / 100, reasons, components, automaticAllocation: false };
}
