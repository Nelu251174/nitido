import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CITIES } from './cities';
import { PUBLIC_SEO_PAGES, publicPageMetadata } from './publicSeo';
import { siteIndexingEnabled } from './siteIndexing';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { proxy } from '@/proxy';
import { metadata as proMetadata } from '@/app/nitido-pro/page';
import { metadata as qualificationMetadata } from '@/app/nitido-pro/aplica/page';
import { metadata as partnerMetadata } from '@/app/nitido-pro/parteneri/page';

afterEach(() => vi.unstubAllEnvs());
const enableProductionIndexing = (site = 'https://nitido.ro') => {
  vi.stubEnv('SITE_PUBLIC_INDEXING', 'true');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', site);
};

describe('public indexability and canonical sitemap', () => {
  it.each(['https://sandbox.nitido.ro', 'http://nitido.ro', 'https://nitido.ro.attacker.test', 'https://user:secret@nitido.ro'])('keeps %s out of indexing even when the flag is enabled', site => {
    enableProductionIndexing(site);
    expect(siteIndexingEnabled()).toBe(false);
    expect(sitemap()).toEqual([]);
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('requires explicit public indexing activation', () => {
    enableProductionIndexing();
    vi.stubEnv('SITE_PUBLIC_INDEXING', 'false');
    expect(sitemap()).toEqual([]);
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('omits disabled Pro pages rather than advertising their 404 responses', () => {
    enableProductionIndexing();
    vi.stubEnv('NEXT_PUBLIC_NITIDO_PRO_PUBLIC', 'false');
    const paths = sitemap().map(entry => new URL(entry.url).pathname);
    expect(paths).toContain('/');
    expect(paths.some(path => path.startsWith('/nitido-pro'))).toBe(false);
    expect(paths).not.toContain('/parteneri-pro');
    expect(paths.filter(path => path.startsWith('/curatenie/'))).toEqual(CITIES.map(city => `/curatenie/${city.slug}`));
  });

  it.each(['https://nitido.ro/', 'https://www.nitido.ro/'])('uses configured canonical origin %s consistently without doubled slashes', site => {
    enableProductionIndexing(site);
    vi.stubEnv('NEXT_PUBLIC_NITIDO_PRO_PUBLIC', 'true');
    const entries = sitemap();
    const paths = entries.map(entry => new URL(entry.url).pathname);
    expect(paths).toEqual([...Object.keys(PUBLIC_SEO_PAGES), ...CITIES.map(city => `/curatenie/${city.slug}`)]);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(expect.arrayContaining(['/nitido-pro', '/nitido-pro/aplica', '/nitido-pro/parteneri']));
    expect(paths).not.toContain('/parteneri-pro');
    expect(paths.some(path => /^\/(?:pro|admin|api|client|firma|login|signup|rezervare|invitatie)(?:\/|$)/.test(path))).toBe(false);
    for (const entry of entries) expect(new URL(entry.url).origin).toBe(new URL(site).origin);
    expect(robots().sitemap).toBe(new URL('/sitemap.xml', site).href);
    const rules = robots().rules;
    if (!Array.isArray(rules)) throw new Error('Production robot rules must be explicit');
    expect(rules[0].disallow).toEqual(expect.arrayContaining(['/pro', '/admin', '/client', '/firma', '/api/']));
  });

  it('gives each real Pro page its own canonical, description and social metadata', () => {
    for (const [path, metadata] of [['/nitido-pro', proMetadata], ['/nitido-pro/aplica', qualificationMetadata], ['/nitido-pro/parteneri', partnerMetadata]] as const) {
      expect(metadata).toEqual(publicPageMetadata(path));
      expect(metadata.alternates?.canonical).toBe(path);
      expect(metadata.openGraph).toMatchObject({
        url: path,
        title: metadata.title,
        description: metadata.description,
        images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'NITIDO.RO — Servicii de curățenie în România' }],
      });
      expect(metadata.twitter).toMatchObject({
        title: metadata.title,
        description: metadata.description,
        card: 'summary_large_image',
        images: ['/opengraph-image'],
      });
      expect(metadata.description).not.toBe(PUBLIC_SEO_PAGES['/'].description);
    }
    expect(new Set([proMetadata.title, qualificationMetadata.title, partnerMetadata.title]).size).toBe(3);
  });

  it('keeps noindex headers on sandbox and private paths while the public Pro landing remains indexable', () => {
    enableProductionIndexing();
    for (const path of ['/pro', '/pro/dashboard', '/admin', '/client', '/firma', '/api/pro/leads', '/login']) {
      const request = new NextRequest(`https://nitido.ro${path}`, { headers: { host: 'nitido.ro' } });
      expect(proxy(request).headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    }
    const publicRequest = new NextRequest('https://nitido.ro/nitido-pro', { headers: { host: 'nitido.ro' } });
    expect(proxy(publicRequest).headers.get('X-Robots-Tag')).toBeNull();
    const sandboxRequest = new NextRequest('https://sandbox.nitido.ro/nitido-pro', { headers: { host: 'sandbox.nitido.ro' } });
    expect(proxy(sandboxRequest).headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
  });
});
