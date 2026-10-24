import { NextRequest, NextResponse } from 'next/server';
import { parseMarketingCsv, marketingKey, MarketingError, normalizeMarketingInput } from '@/lib/adminMarketing';
import { collectMarketingAnaf } from '@/lib/adminMarketingCollection';
import { marketingAccess, marketingBody, marketingFailure } from '@/lib/adminMarketingAccess';

// Preview only: neither collection source can write contacts or dispatch messages.
export async function POST(req: NextRequest) {
  const access = await marketingAccess(req, true); if (access.error) return access.error;
  try {
    const body = await marketingBody(req);
    if (body.source === 'anaf') return NextResponse.json(await collectMarketingAnaf(body));
    if (body.source !== 'csv') throw new MarketingError('Sursă invalidă.');
    const all = parseMarketingCsv(body.csv).map(row=>body.county&&!row.county?normalizeMarketingInput({...row,county:body.county}):row);
    if (body.category && !['business', 'cleaning', 'individual'].includes(String(body.category))) throw new MarketingError('Categorie invalidă.');
    if (body.city !== undefined && (typeof body.city !== 'string' || body.city.length > 100)) throw new MarketingError('Localitate invalidă.');
    const contacts = all.filter(row => (!body.category || row.category === body.category) && (!body.city || marketingKey(row.city) === marketingKey(body.city as string)));
    return NextResponse.json({ contacts, requested: all.length, excluded: all.length - contacts.length, notFound: 0 });
  } catch (error) { return marketingFailure(error); }
}
