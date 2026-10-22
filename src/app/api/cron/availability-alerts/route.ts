import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {processAvailabilityAlerts,availabilityAlertsEnabled} from '@/lib/availabilityAlerts';
import {retentionMetrics} from '@/lib/retentionMetrics';
import {readFile} from 'node:fs/promises';
export const runtime='nodejs';
function authorized(req:NextRequest){const secret=process.env.NITIDO_AVAILABILITY_CRON_SECRET??'',actual=Buffer.from(req.headers.get('x-cron-secret')??''),expected=Buffer.from(secret);return secret.length>=32&&actual.length===expected.length&&timingSafeEqual(actual,expected);}
/** Authenticated deployment evidence, containing counts and checks, no identities or credentials. */
export async function GET(req:NextRequest){
  if(!authorized(req))return NextResponse.json({error:'Neautorizat'},{status:401});
  let checkpoint:unknown=null;
  try{const v=JSON.parse(await readFile('/app/data/release-checkpoints/20261022-before-retention/verification.json','utf8'));checkpoint={status:v.status,createdAt:v.createdAt,baseCommit:v.baseCommit,snapshotSha256:v.snapshotSha256,uploadFileCount:v.uploadFileCount,method:v.method};}catch{}
  let sandboxVerification:unknown=null;if(process.env.NEXT_PUBLIC_SITE_URL==='https://sandbox.nitido.ro'){try{sandboxVerification=JSON.parse(await readFile('/app/data/release-checkpoints/retention-api-verification.json','utf8'));}catch{}}
  return NextResponse.json({enabled:availabilityAlertsEnabled(),metrics:retentionMetrics(db),checkpoint,sandboxVerification},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:NextRequest){
  if(!authorized(req))return NextResponse.json({error:'Neautorizat'},{status:401});
  if(!availabilityAlertsEnabled())return NextResponse.json({status:'disabled',queued:0,sent:0,suppressed:0},{headers:{'Cache-Control':'no-store'}});
  try{return NextResponse.json({status:'completed',...await processAvailabilityAlerts(db)},{headers:{'Cache-Control':'no-store'}});}
  catch{return NextResponse.json({error:'Procesarea alertelor necesită verificare.'},{status:503});}
}
