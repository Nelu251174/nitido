import {describe, expect, it, vi} from 'vitest';
import {textKey} from './text';

vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'en',
  getMessages: async () => ({ui: {[textKey('Curățenie')]: 'Cleaning'}}),
}));

import {localizeMetadata} from './server';

describe('localized metadata inheritance', () => {
  it('leaves parent display fields inherited for private layouts with only robots settings', async () => {
    const metadata = {robots: {index: false, follow: false}, alternates: {canonical: null}};
    const localized = await localizeMetadata(metadata);
    expect(localized).toEqual(metadata);
    for (const field of ['title', 'description', 'openGraph', 'twitter']) {
      expect(Object.hasOwn(localized, field)).toBe(false);
    }
  });

  it('keeps explicit clearing while translating present display fields', async () => {
    expect(await localizeMetadata({title: null, description: null, openGraph: null, twitter: null})).toEqual({title: null, description: null, openGraph: null, twitter: null});
    const localized = await localizeMetadata({title: {default: 'Curățenie', template: '%s — NITIDO.RO'}, description: 'Curățenie', alternates: {canonical: '/curatenie'}});
    expect(localized.title).toEqual({default: 'Cleaning', template: '%s — NITIDO.RO'});
    expect(localized.description).toBe('Cleaning');
    expect(localized.alternates?.canonical).toBe('/curatenie');
  });
});
