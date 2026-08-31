import type { Job, SpaceType } from "./types";
import { ApiError } from "./apiCore";

export const SLOT_HOURS = [8, 10, 12, 14, 16, 18] as const;
export const MAX_DETAILS_LENGTH = 500;
export const MAX_PHOTOS = 5;
export const POST_JOB_STEP_COUNT = 10;

export function nextPostStep(step: number): number { return Math.min(Math.max(step, 0) + 1, POST_JOB_STEP_COUNT - 1); }
export function previousPostStep(step: number): number { return Math.max(Math.min(step, POST_JOB_STEP_COUNT - 1) - 1, 0); }
export function canAddPhoto(count: number): boolean { return count >= 0 && count < MAX_PHOTOS; }

export type JobQuote = {
  spaceType: SpaceType;
  sqm: number;
  priceGross: number;
  durationMinutes: number;
  currency: "RON";
};
export type SchedulingConfig = { slotHours: number[]; minLeadHours: number };

export type PostJobDraft = {
  spaceType: SpaceType | null;
  sqm: string;
  city: string;
  street: string;
  postalCode: string;
  floor: string;
  scheduledDate: string;
  scheduledHour: number | null;
  details: string;
  photoIds: string[];
};

export const EMPTY_DRAFT: PostJobDraft = {
  spaceType: null,
  sqm: "",
  city: "",
  street: "",
  postalCode: "",
  floor: "",
  scheduledDate: "",
  scheduledHour: null,
  details: "",
  photoIds: [],
};

export function validateSqm(value: string): string | null {
  if (!/^\d+$/.test(value.trim()) || Number(value) <= 0) return "Introdu o suprafață întreagă, mai mare decât 0 m².";
  return null;
}

export function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateAllowed(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const chosen = new Date(`${value}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return !Number.isNaN(chosen.getTime()) && chosen >= today;
}

export function isSlotAllowed(date: string, hour: number | null, now = new Date(), slotHours: readonly number[] = SLOT_HOURS, minLeadHours = 1): boolean {
  if (!isDateAllowed(date, now) || hour === null || !slotHours.includes(hour)) return false;
  const slot = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
  return slot.getTime() - now.getTime() >= minLeadHours * 60 * 60 * 1000;
}

export function quoteKey(draft: Pick<PostJobDraft, "spaceType" | "sqm">): string | null {
  if (!draft.spaceType || validateSqm(draft.sqm)) return null;
  return `${draft.spaceType}:${Number(draft.sqm)}`;
}

export function quoteMatchesDraft(quote: JobQuote | null, draft: PostJobDraft): boolean {
  return Boolean(quote && quoteKey(draft) === `${quote.spaceType}:${quote.sqm}`);
}

export function buildCreatePayload(draft: PostJobDraft) {
  if (!draft.spaceType || validateSqm(draft.sqm) || !draft.city.trim() || !draft.street.trim() || !isDateAllowed(draft.scheduledDate) || draft.scheduledHour === null) {
    throw new Error("Datele lucrării nu sunt complete.");
  }
  return {
    street: draft.street.trim(),
    postalCode: draft.postalCode.trim() || undefined,
    city: draft.city.trim(),
    floor: draft.floor.trim() || undefined,
    details: draft.details.trim() || undefined,
    sqm: Number(draft.sqm),
    spaceType: draft.spaceType,
    whenType: "scheduled" as const,
    scheduledDate: `${draft.scheduledDate}T00:00:00`,
    scheduledHour: draft.scheduledHour,
    photoIds: draft.photoIds,
  };
}

export function postJobError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sesiunea a expirat. Autentifică-te din nou.";
    if (error.status === 409) return "Cererea a fost deja procesată. Reîncarcă lista lucrărilor.";
    if (error.status >= 500) return "NITIDO nu poate publica lucrarea momentan. Încearcă din nou.";
    return error.message;
  }
  return "Conexiunea a fost întreruptă. Datele au rămas în formular; poți încerca din nou.";
}

export type CreatedJobResponse = { job: Job };
