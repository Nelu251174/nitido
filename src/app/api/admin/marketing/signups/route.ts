import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {marketingAccess,marketingBody,marketingFailure} from '@/lib/adminMarketingAccess';
import {MarketingError} from '@/lib/adminMarketing';
import {marketingSignupView,withdrawMarketingSignup} from '@/lib/adminMarketingSignup';
export async function GET(req:NextRequest){const a=await marketingAccess(req);if(a.error)return a.error;try{return NextResponse.json(marketingSignupView(db,req.nextUrl.searchParams),{headers:{'Cache-Control':'no-store'}});}catch(e){return marketingFailure(e);}}
export async function POST(req:NextRequest){const a=await marketingAccess(req,true);if(a.error)return a.error;try{const b=await marketingBody(req);if(b.action!=='withdraw')throw new MarketingError('Acțiune invalidă.');return NextResponse.json(withdrawMarketingSignup(db,b.id,b.version,a.actor!));}catch(e){return marketingFailure(e);}}
