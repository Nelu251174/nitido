/** Same-tab session draft. No address, contact, payment or account data. */
export const BOOKING_DRAFT_KEY = 'nitido.booking-draft.v1';
/** Preserve existing Romanian intent before considering a new IP suggestion.
 * Private drafts are checked for presence only, never decoded or changed here. */
export function hasStoredBookingContext(storage:Pick<Storage,'getItem'>):boolean {
  try {
    const saved=storage.getItem(BOOKING_DRAFT_KEY);
    return Boolean(saved&&Object.keys(cleanBookingDraft(JSON.parse(saved))).length)
      || Boolean(storage.getItem('nitido:card-booking-draft:v1'));
  }catch{return true;}
}
export const BOOKING_DRAFT_FIELDS = ['cleaningType','flexibleWindows','propertyId','city','sqm','spaceType','bathroomCount','windowsSqm','scheduled','date','hour','mode'] as const;
export function cleanBookingDraft(value: unknown): Record<string,string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string,string> = {};
  for (const key of BOOKING_DRAFT_FIELDS) {
    const field = (value as Record<string,unknown>)[key];
    if (typeof field === 'string' && field.length <= (key==='flexibleWindows'?300:100)) result[key] = field;
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
