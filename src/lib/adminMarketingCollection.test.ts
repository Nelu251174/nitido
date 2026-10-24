import { describe, expect, it, vi } from 'vitest';
import { collectMarketingAnaf } from './adminMarketingCollection';

const request = { city: 'Constanța', category: 'business', cuis: 'RO123456, 234567, 345678,456789,567890' };
const entry = (cui: number, city?: string, other = {}) => ({ date_generale: { cui, denumire: 'Firma sintetică', ...other }, adresa_sediu_social: { sdenumire_Localitate: city } });
describe('ANAF collection preview', () => {
  it('uses one fixed endpoint and includes only requested, active firms in the exact locality', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ found: [entry(123456, 'Constanta'), entry(234567, 'București'), entry(345678, undefined), entry(456789, 'Constanța', { data_radiere: '2026-01-01' }), entry(999999, 'Constanța')] })));
    const preview = await collectMarketingAnaf(request, fetcher);
    expect(preview).toMatchObject({ requested: 5, excluded: 3, notFound: 1 });
    expect(preview.contacts).toHaveLength(1);
    expect(preview.contacts[0]).toMatchObject({ cui: '123456', email: '', consent: 'not_recorded' });
    expect(fetcher.mock.calls[0][0]).toBe('https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store' });
  });
  it('never performs network calls for individuals, invalid CUI input or missing city', async () => {
    const fetcher = vi.fn();
    for (const patch of [{ category: 'individual' }, { cuis: 'https://evil.test' }, { city: '' }, { cuis: Array.from({ length: 21 }, (_, i) => String(100 + i)).join(',') }]) await expect(collectMarketingAnaf({ ...request, ...patch }, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reports provider outages without returning provider data or fabricated contacts', async () => {
    await expect(collectMarketingAnaf(request, vi.fn().mockRejectedValue(Error('private response')))).rejects.toThrow('ANAF nu este disponibil');
    await expect(collectMarketingAnaf(request, vi.fn().mockResolvedValue(new Response('{}')))).rejects.toThrow('ANAF nu este disponibil');
  });
});
