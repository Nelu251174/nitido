import { describe, expect, it } from 'vitest';
import manifestJson from '@/data/internationalResearchReview.json';
import type { InternationalResearchManifest } from './internationalResearchTypes';
import { EU_COUNTRIES } from './serviceMarkets';

const manifest = manifestJson as unknown as InternationalResearchManifest;
const cities = manifest.countries.flatMap(country => country.cities);
const sources = cities.flatMap(city => city.sources);

function canonical(url: string) {
  const u = new URL(url);
  u.hostname = u.hostname.replace(/^www\./, '');
  u.pathname = u.pathname.replace(/\/$/, '') || '/';
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) if (key.startsWith('utm_')) u.searchParams.delete(key);
  return u.href;
}

describe('international public research evidence', () => {
  it('covers exactly the configured 26 foreign countries and 78 unique city keys, never Romania', () => {
    expect(manifest.countries.map(country => country.code).sort()).toEqual(EU_COUNTRIES.filter(code => code !== 'RO').slice().sort());
    expect(cities).toHaveLength(78);
    expect(new Set(cities.map(city => city.id)).size).toBe(78);
    for (const country of manifest.countries) expect(country.cities).toHaveLength(3);
    expect(manifest.scope.romaniaIncluded).toBe(false);
  });

  it('never turns research into a commercial approval, including two published-price sources', () => {
    expect(manifest.researchOnly).toBe(true);
    expect(manifest.scope.commercialPricesGenerated).toBe(false);
    for (const city of cities) {
      expect(city.commercialReady).toBe(false);
      expect(city.completeCount).toBe(0);
      expect(city.gaps.length).toBeGreaterThan(0);
      expect(['incomplete', 'needs_clarification']).toContain(city.reviewStatus);
      expect(city.serviceCategories).toEqual(['apartament', 'casa', 'birou']);
      for (const category of city.categoryReviews) {
        expect(category.requiredWorkers).toEqual([1, 2]);
        expect(category.minimumRequestedOnsiteHours).toBe(3);
        expect(category.commercialReady).toBe(false);
      }
      for (const source of city.sources) {
        expect(source.commercialReady).toBe(false);
        expect(source.conditionsComplete).toBe(false);
        expect(source.legalIndependence.status).toBe('not_independently_verified');
      }
    }
  });

  it('retains public URL/date provenance and deduplicates the same source per city', () => {
    for (const city of cities) {
      expect(new Set(city.sources.map(source => canonical(source.url))).size).toBe(city.sources.length);
      for (const source of city.sources) {
        const url = new URL(source.url);
        expect(['http:', 'https:']).toContain(url.protocol);
        expect(url.username).toBe('');
        expect(url.password).toBe('');
        expect(Number.isNaN(Date.parse(source.readAt))).toBe(false);
        expect(source.provenance.sourceURL).toBe(source.url);
        expect(source.cityKeys).toContain(city.cityKey);
      }
    }
  });

  it('keeps carpet-only and fragment-only sources out of whole-property evidence', () => {
    const unrelated = sources.filter(source => /s-tate\.gr|clean-bro\.com/.test(source.url));
    expect(unrelated.length).toBeGreaterThan(0);
    for (const source of unrelated) expect(source.wholePropertyEvidenceEligible).toBe(false);
    const duplicatedKarin = sources.filter(source => /te-mi\.cz|uklidovasluzba\.eu/.test(source.url));
    expect(duplicatedKarin.length).toBeGreaterThan(1);
    expect(new Set(duplicatedKarin.map(source => source.providerKey)).size).toBe(1);
  });

  it('preserves the 10 worker-hour supplier minimum instead of pretending 2 workers for 3 hours suffice', () => {
    const example = sources.find(source => source.provider === 'C-Maxi Flyteam' && source.provenance.snapshot === 'current');
    expect(example).toBeDefined();
    expect(example?.minimum).toMatchObject({ labourHours: 10, typicalWorkers: 2, typicalOnsiteHours: 5 });
    expect(example?.prices).toContainEqual(expect.objectContaining({ amount: 47.44, unit: 'person_hour' }));
    expect(2 * 3).toBeLessThan(10);
    expect(example?.commercialReady).toBe(false);
  });

  it('exposes only public research conditions, without local paths or business registration identifiers', () => {
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toMatch(/\/workspace\/|\/tmp\//);
    expect(serialized).not.toMatch(/"(?:identity|rawEvidenceFile|rawFile|VATIdentifier|KvK|RCS|establishmentAuthorization)"\s*:/);
    expect(serialized).not.toMatch(/COOLIFY_TOKEN|RESEND_API_KEY|STRIPE_SECRET_KEY/);
  });
  it('keeps all displayed counts consistent and excludes unrelated numeric services',()=>{
    const relevant=(source:typeof sources[number])=>source.read&&source.ownPublishedPrice&&source.wholePropertyEvidenceEligible;
    for(const city of cities){expect(city.publishedCount).toBe(city.sources.filter(relevant).length);expect(city.ownPriceSourceCount).toBe(city.publishedCount);}
    expect(manifest.totals.sourceAssignments).toBe(sources.length);
    expect(manifest.totals.sourceAssignmentsAfterURLDeduplication).toBe(sources.length);
    expect(manifest.totals.citiesWithTwoOwnPublishedPriceSources).toBe(cities.filter(city=>city.publishedCount>=2).length);
    expect(manifest.totals.citiesWithoutTwoOwnPublishedPriceSources).toBe(cities.filter(city=>city.publishedCount<2).length);
    expect(manifest.totals.citiesWithTwoOwnPublishedPriceSources+manifest.totals.citiesWithoutTwoOwnPublishedPriceSources).toBe(78);
  });

});
