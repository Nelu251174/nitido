import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAdminAction } from '@/lib/adminAuth';
import { marketingCsvChunks, listMarketingContacts, saveMarketingContacts, updateMarketingContact, bulkMarketingContactStatus, MarketingError } from '@/lib/adminMarketing';
import { marketingAccess, marketingBody, marketingFailure } from '@/lib/adminMarketingAccess';
import { recordMarketingCollection } from '@/lib/adminMarketingWorkspace';

export async function GET(req: NextRequest) {
  const access = await marketingAccess(req); if (access.error) return access.error;
  try {
    if (req.nextUrl.searchParams.get('format') === 'csv') {
      const csv = marketingCsvChunks(db, req.nextUrl.searchParams);
      const first=csv.next(); // Validate filters and initialize before sending response headers.
      const encoder=new TextEncoder();let initial=true;
      const stream=new ReadableStream<Uint8Array>({pull(controller){try{const next=initial?first:csv.next();initial=false;if(next.done)controller.close();else controller.enqueue(encoder.encode(next.value));}catch(error){controller.error(error);}},cancel(){csv.return(undefined);}});
      auditAdminAction('marketing.contacts.exported', null);
      return new NextResponse(stream, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="contacte-marketing.csv"', 'Cache-Control': 'private, no-store' } });
    }
    return NextResponse.json(listMarketingContacts(db, req.nextUrl.searchParams));
  } catch (error) { return marketingFailure(error); }
}
export async function POST(req: NextRequest) {
  const access = await marketingAccess(req, true); if (access.error) return access.error;
  try {
    const body = await marketingBody(req);
    if (!Array.isArray(body.contacts)) throw new MarketingError('Lista de contacte lipsește.');
    const result = db.transaction(() => {
      const saved = saveMarketingContacts(db, body.contacts as unknown[], access.actor!);
      if (body.collection) recordMarketingCollection(db, body.collection, (body.contacts as unknown[]).length, saved, access.actor!);
      auditAdminAction('marketing.contacts.saved', access.actor!, saved);
      return saved;
    })();
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return marketingFailure(error); }
}
export async function PATCH(req: NextRequest) {
  const access = await marketingAccess(req, true); if (access.error) return access.error;
  try {
    const body = await marketingBody(req);
    const result = db.transaction(() => {
      if (body.selection) {
        const updated = bulkMarketingContactStatus(db, body.selection, body.status);
        auditAdminAction('marketing.contacts.status', access.actor!, { ...updated, status: body.status });
        return updated;
      }
      const updated = updateMarketingContact(db, body);
      auditAdminAction('marketing.contact.updated', updated.id, { actor: access.actor, status: body.status, consent: body.consent });
      return updated;
    })();
    return NextResponse.json(result);
  } catch (error) { return marketingFailure(error); }
}
