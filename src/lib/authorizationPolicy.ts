import type {JobTiming} from './firmAvailability';
export const CONFIRMATION_WINDOW_HOURS=48;
export const AUTHORIZATION_POLICY_VERSION='nitido-hold-coverage-2026-10-20-v1';
export const AUTHORIZATION_NOTICE='Poți programa cererea din timp. Acceptarea finală și HOLD-ul se confirmă în ultimele 48 de ore înainte de începere, numai dacă autorizarea cardului acoperă intervenția și bufferul. Nu se încasează anticipat și nu se reautorizează automat cardul.';
export function confirmationOpensAt(job:JobTiming){const start=Date.parse(job.scheduled_at??'');return Number.isFinite(start)?start-CONFIRMATION_WINDOW_HOURS*3600000:null}
