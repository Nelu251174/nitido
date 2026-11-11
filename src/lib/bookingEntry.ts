import {EU_COUNTRIES} from './serviceMarkets';

type Search = Record<string, string | string[] | undefined>;

/** Routing is a suggestion only. Server quotes still validate the work's country. */
export function foreignBookingCountry(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const code = value.trim().toUpperCase();
  return code !== 'RO' && EU_COUNTRIES.some(country => country === code) ? code : undefined;
}

export function internationalBookingHref(country?: string): string {
  const code = foreignBookingCountry(country);
  return '/international/booking' + (code ? '?' + new URLSearchParams({countryCode: code})
    : country !== undefined ? '?countryCode=' : '');
}

export function bookingEntryRedirect(query: Search, visitorCountry: string | null, enabled: boolean): string | null {
  if (!enabled) return null;
  if (query.countryCode !== undefined) {
    if (typeof query.countryCode === 'string' && query.countryCode.trim().toUpperCase() === 'RO') return null;
    // Unknown/duplicated explicit countries open the chooser, never a Romanian quote.
    return internationalBookingHref(foreignBookingCountry(query.countryCode) ?? '');
  }
  // Preserve existing Romanian links/drafts, including fields added by older clients.
  const hasExistingContext = Object.entries(query).some(([key, value]) => value !== undefined
    && !key.startsWith('utm_') && key !== 'gclid' && key !== 'fbclid');
  if (hasExistingContext) return null;
  const country = foreignBookingCountry(visitorCountry);
  return country ? internationalBookingHref(country) : null;
}

export function internationalInitialCountry(requested: unknown, visitorCountry: string | null): string | undefined {
  // Empty means explicitly unselected; undefined permits a later IP suggestion.
  return requested !== undefined ? foreignBookingCountry(requested) ?? '' : foreignBookingCountry(visitorCountry);
}
