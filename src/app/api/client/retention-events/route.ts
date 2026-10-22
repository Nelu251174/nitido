import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
import {retentionEvent} from '@/lib/retentionMetrics';
import {RetentionError} from '@/lib/clientRetention';
export async function POST(req:NextRequest){
  const u=await getCurrentUser(req);if(u?.role!=='client')return NextResponse.json({error:'Autentificare client necesară'},{status:401});
  if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:'Origine invalidă'},{status:403});
  if(!consumeRateLimit('retention-event:'+u.id,60,60000))return NextResponse.json({error:'Reîncearcă mai târziu.'},{status:429});
  const text=await req.text();if(text.length>500)return NextResponse.json({error:'Cerere prea mare'},{status:413});
  try{const b=JSON.parse(text);retentionEvent(db,u.id,b.kind,b.resourceId);return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});}
  catch(e){return NextResponse.json({error:e instanceof RetentionError?e.message:'Eveniment invalid.'},{status:e instanceof RetentionError?e.status:400});}
}
