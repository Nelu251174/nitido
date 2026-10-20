import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getStripeClient} from '@/lib/payments';
import {recoverAuthorizationCoverage} from '@/lib/authorizationCoverage';
export async function POST(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.trim().length<32)return NextResponse.json({error:'Mentenanță neconfigurată'},{status:503});
 if(req.headers.get('x-cron-secret')!==secret)return NextResponse.json({error:'Neautorizat'},{status:401});
 const pending=db.prepare("SELECT 1 FROM authorization_coverage WHERE state='release_pending' AND next_retry_ms<=? AND lease_until_ms<=? LIMIT 1").get(Date.now(),Date.now());
 if(!pending)return NextResponse.json({attempted:0,released:0});
 const stripe=getStripeClient({timeout:4000,maxNetworkRetries:0});if(!stripe)return NextResponse.json({error:'Procesator indisponibil'},{status:503});
 return NextResponse.json(await recoverAuthorizationCoverage(db,stripe));
}
