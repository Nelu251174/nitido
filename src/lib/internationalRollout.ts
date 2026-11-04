/** New international booking is opt-in; existing Romanian contracts ignore these gates. */
function site(): URL | null {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) return null;
    return url;
  } catch { return null; }
}

function isolatedSite(): boolean {
  const url = site();
  if (!url || /^(?:sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? '')) return false;
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || (url.origin === 'https://sandbox.nitido.ro');
}

/** Review pages and synthetic fixtures never become available on the LIVE origin. */
export function internationalReviewEnabled(): boolean {
  return isolatedSite() && (process.env.NITIDO_INTERNATIONAL_REVIEW_ENABLED === 'true'
    || process.env.NITIDO_ENABLE_INTERNATIONAL_PRICING === 'true');
}

/** This gate does not approve a tariff: the tariff store must validate approval separately. */
export function internationalPricingEnabled(): boolean {
  if (process.env.NITIDO_ENABLE_INTERNATIONAL_PRICING !== 'true') return false;
  if (isolatedSite()) return true;
  return site()?.origin === 'https://nitido.ro'
    && process.env.NITIDO_INTERNATIONAL_LIVE_APPROVED === 'true';
}
