import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { marketingAccess, marketingBody, marketingFailure } from '@/lib/adminMarketingAccess';
import { MarketingError } from '@/lib/adminMarketing';
import { getMarketingWorkspace, previewMarketingCampaign, saveMarketingCampaign, saveMarketingSettings, setMarketingCampaignState, simulateMarketingCampaign } from '@/lib/adminMarketingWorkspace';
export async function GET(req: NextRequest) {
  const access = await marketingAccess(req); if (access.error) return access.error;
  try { return NextResponse.json(getMarketingWorkspace(db)); } catch (error) { return marketingFailure(error); }
}
export async function POST(req: NextRequest) {
  const access = await marketingAccess(req, true); if (access.error) return access.error;
  try {
    const body = await marketingBody(req); let result: unknown;
    if (body.action === 'settings') result = saveMarketingSettings(db, body.data, access.actor!);
    else if (body.action === 'save') result = saveMarketingCampaign(db, body.data, access.actor!);
    else if (body.action === 'state') result = setMarketingCampaignState(db, body.data, access.actor!);
    else if (body.action === 'simulate') result = simulateMarketingCampaign(db, body.data, access.actor!);
    else if (body.action === 'preview' && typeof body.id === 'string') result = previewMarketingCampaign(db, body.id);
    else throw new MarketingError('Acțiune Marketing invalidă. Trimiterea reală nu este activată.');
    return NextResponse.json({ result });
  } catch (error) { return marketingFailure(error); }
}
