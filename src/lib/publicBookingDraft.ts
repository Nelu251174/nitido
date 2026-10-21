/** Same-tab session draft. No address, contact, payment or account data. */
export const BOOKING_DRAFT_KEY = 'nitido.booking-draft.v1';
export const BOOKING_DRAFT_FIELDS = ['city','sqm','spaceType','bathroomCount','windowsSqm','scheduled','date','hour','mode'] as const;
export function cleanBookingDraft(value: unknown): Record<string,string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string,string> = {};
  for (const key of BOOKING_DRAFT_FIELDS) {
    const field = (value as Record<string,unknown>)[key];
    if (typeof field === 'string' && field.length <= 100) result[key] = field;
  }
  return result;
}
export function readBookingDraft(): Record<string,string> {
  try { return cleanBookingDraft(JSON.parse(sessionStorage.getItem(BOOKING_DRAFT_KEY) || '{}')); }
  catch { return {}; }
}
export function saveBookingDraft(value: Record<string,string>) {
  try { sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(cleanBookingDraft(value))); }
  catch { /* Navigation still transfers selections in the URL without browser storage. */ }
}

export function mergePublicBookingDraft(defaults:Record<string,string>,saved:Record<string,string>,initial:Record<string,string>,sameSource:boolean){
 return sameSource?{...defaults,...cleanBookingDraft(initial),...cleanBookingDraft(saved)}:{...defaults,...cleanBookingDraft(saved),...cleanBookingDraft(initial)};
}
