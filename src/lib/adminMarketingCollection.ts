import { MarketingError, marketingKey, normalizeMarketingInput } from './adminMarketing';
import type { MarketingInput } from './adminMarketingShared';

const ANAF_URL = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva';
type AnafEntry = {
  date_generale?: { cui?: number; denumire?: string; adresa?: string; stare_inregistrare?: string; data_radiere?: string; telefon?: string };
  adresa_sediu_social?: { sdenumire_Localitate?: string; sdenumire_localitate?: string };
};

/** ANAF supplies company identities, not email addresses or marketing consent. */
export async function collectMarketingAnaf(value: unknown, fetcher: typeof fetch = fetch) {
  if (!value || typeof value !== 'object') throw new MarketingError('Cerere invalidă.');
  const b = value as Record<string, unknown>;
  if (!['business', 'cleaning'].includes(String(b.category))) throw new MarketingError('Colectarea ANAF este disponibilă numai pentru firme.');
  if (typeof b.city !== 'string' || !b.city.trim() || b.city.length > 100) throw new MarketingError('Alege localitatea.');
  if (typeof b.cuis !== 'string' || b.cuis.length > 500) throw new MarketingError('Introdu 1–20 de CUI-uri.');
  const cuis = [...new Set(b.cuis.trim().split(/[\s,;]+/).map(x => x.replace(/^RO/i, '')))];
  if (!cuis.length || cuis.length > 20 || cuis.some(x => !/^\d{2,10}$/.test(x))) throw new MarketingError('Introdu 1–20 de CUI-uri valide, separate prin spațiu sau virgulă.');
  let data: { found?: AnafEntry[]; notFound?: unknown[] };
  try {
    const response = await fetcher(ANAF_URL, {
      method: 'POST', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuis.map(cui => ({ cui: Number(cui), data: new Date().toISOString().slice(0, 10) }))),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error();
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1000000) throw Error();
    data = JSON.parse(raw);
    if (!data || !Array.isArray(data.found)) throw Error();
  } catch { throw new MarketingError('ANAF nu este disponibil acum. Nu s-a salvat niciun contact.', 502); }
  const contacts: MarketingInput[] = [];
  let excluded = 0;
  const seen = new Set<string>();
  for (const entry of data.found!) {
    const general = entry?.date_generale;
    const cui = String(general?.cui ?? '');
    if (!cuis.includes(cui) || seen.has(cui)) continue;
    seen.add(cui);
    const city = entry.adresa_sediu_social?.sdenumire_Localitate ?? entry.adresa_sediu_social?.sdenumire_localitate;
    // Never label an unknown locality as the requested locality.
    if (!city || marketingKey(city) !== marketingKey(b.city) || general?.data_radiere || /radia/i.test(general?.stare_inregistrare ?? '')) { excluded++; continue; }
    contacts.push(normalizeMarketingInput({
      name: general?.denumire, cui, city, category: b.category, source: ANAF_URL,
      consent: 'not_recorded', notes: `Colectare ANAF ${new Date().toISOString().slice(0, 10)}. Categoria a fost selectată de administrator și necesită verificare.`,
    }));
  }
  return { contacts, requested: cuis.length, excluded, notFound: cuis.length - seen.size };
}
