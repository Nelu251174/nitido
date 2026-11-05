import {afterEach, expect, it, vi} from 'vitest';
import {internationalPricingEnabled, internationalReviewEnabled} from './internationalRollout';

afterEach(() => vi.unstubAllEnvs());
function setup(url: string, enabled = 'true', liveApproved = '') {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', url);
  vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING', enabled);
  vi.stubEnv('NITIDO_INTERNATIONAL_REVIEW_ENABLED', '');
  vi.stubEnv('NITIDO_INTERNATIONAL_LIVE_APPROVED', liveApproved);
  vi.stubEnv('STRIPE_SECRET_KEY', '');
}

it('keeps LIVE pricing disabled without a separate explicit release approval', () => {
  setup('https://nitido.ro');
  expect(internationalPricingEnabled()).toBe(false);
  expect(internationalReviewEnabled()).toBe(false);
  setup('https://nitido.ro', 'true', 'true');
  expect(internationalPricingEnabled()).toBe(true);
  expect(internationalReviewEnabled()).toBe(false);
});

it.each(['http://localhost:3210', 'http://127.0.0.1:3210', 'http://[::1]:3210', 'https://sandbox.nitido.ro'])
('allows opted-in isolated preview at %s without LIVE Stripe credentials', url => {
  setup(url);
  expect(internationalPricingEnabled()).toBe(true);
  expect(internationalReviewEnabled()).toBe(true);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_synthetic_guard_fixture');
  expect(internationalPricingEnabled()).toBe(false);
  expect(internationalReviewEnabled()).toBe(false);
});

it.each(['https://nitido.ro.evil.invalid', 'https://localhost.evil.invalid', 'https://sandbox.nitido.ro.evil.invalid',
  'http://nitido.ro', 'https://nitido.ro:8443', 'https://user:pass@nitido.ro', 'https://nitido.ro/?preview=1',
  'https://nitido.ro/foreign', 'invalid'])
('rejects an untrusted or ambiguous base URL %s', url => {
  setup(url, 'true', 'true');
  expect(internationalPricingEnabled()).toBe(false);
  expect(internationalReviewEnabled()).toBe(false);
});

it('never treats a review flag as permission for new payments', () => {
  setup('http://localhost:3210', 'false');
  vi.stubEnv('NITIDO_INTERNATIONAL_REVIEW_ENABLED', 'true');
  expect(internationalReviewEnabled()).toBe(true);
  expect(internationalPricingEnabled()).toBe(false);
});
