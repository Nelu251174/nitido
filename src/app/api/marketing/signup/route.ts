import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {marketingPublicRequest} from '@/lib/marketingPublicRequest';
import {marketingFailure} from '@/lib/adminMarketingAccess';
import {submitMarketingSignup} from '@/lib/adminMarketingSignup';
export async function POST(req:NextRequest){try{return NextResponse.json(submitMarketingSignup(db,await marketingPublicRequest(req,'signup')),{status:202,headers:{'Cache-Control':'no-store'}});}catch(e){return marketingFailure(e);}}
