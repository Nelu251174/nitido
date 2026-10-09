import type { Database } from 'better-sqlite3';
import { SCORE_COMPONENTS, type ScoreComponent, type ScorePolicy } from './providerScoreShared';
export class ProviderScoreError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function validateScorePolicy(raw: unknown): ScorePolicy {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ProviderScoreError('Regulă de scor invalidă.');
  const b = raw as Record<string, unknown>;
  if (Object.keys(b).some(key => !['mode', 'periodDays', 'minimumCompletedJobs', 'minimumSamples', 'weights'].includes(key)) || b.mode !== 'observation')
    throw new ProviderScoreError('Scorul poate fi configurat numai pentru observare.');
  const bounded = (value: unknown, max: number) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= max;
  if (!bounded(b.periodDays, 365) || !bounded(b.minimumCompletedJobs, 10000) || !bounded(b.minimumSamples, 10000))
    throw new ProviderScoreError('Perioadă de 1–365 zile și volume minime de 1–10.000 obligatorii.');
  if (!b.weights || typeof b.weights !== 'object' || Array.isArray(b.weights)) throw new ProviderScoreError('Ponderi obligatorii.');
  const weights = b.weights as Record<string, unknown>, keys = Object.keys(SCORE_COMPONENTS) as ScoreComponent[];
  if (Object.keys(weights).length !== keys.length || keys.some(key => !Object.hasOwn(weights, key) || typeof weights[key] !== 'number' || !Number.isInteger(weights[key]) || (weights[key] as number) < 0 || (weights[key] as number) > 100) || keys.reduce((sum, key) => sum + Number(weights[key]), 0) !== 100)
    throw new ProviderScoreError('Ponderile componentelor trebuie să fie întregi, între 0 și 100, cu total 100.');
  return { mode: 'observation', periodDays: b.periodDays as number, minimumCompletedJobs: b.minimumCompletedJobs as number, minimumSamples: b.minimumSamples as number, weights: Object.fromEntries(keys.map(key => [key, weights[key]])) as ScorePolicy['weights'] };
}
export function scorePolicy(db: Database) {
  const row = db.prepare('SELECT * FROM provider_score_policies ORDER BY revision DESC LIMIT 1').get() as { revision: number; definition_json: string; reason: string; actor_id: string; created_at: string } | undefined;
  return row ? { revision: row.revision, definition: validateScorePolicy(JSON.parse(row.definition_json)), reason: row.reason, actor: row.actor_id, createdAt: row.created_at } : null;
}
export function saveScorePolicy(db: Database, b: Record<string, unknown>, actor: string) {
  if (!db.inTransaction || !actor) throw new ProviderScoreError('Tranzacție administrativă obligatorie.', 500);
  const current = scorePolicy(db);
  if (b.revision !== (current?.revision ?? 0)) throw new ProviderScoreError('Regula a fost modificată. Reîncarcă.', 409);
  if (typeof b.reason !== 'string' || !b.reason.trim() || b.reason.length > 2000) throw new ProviderScoreError('Motiv obligatoriu, maximum 2.000 de caractere.');
  const definition = validateScorePolicy(b.definition), revision = (current?.revision ?? 0) + 1;
  db.prepare('INSERT INTO provider_score_policies VALUES(?,?,?,?,?)').run(revision, JSON.stringify(definition), b.reason.trim(), actor, new Date().toISOString());
  return { revision, definition };
}
