import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {marketingPublicRequest} from '@/lib/marketingPublicRequest';
import {marketingFailure} from '@/lib/adminMarketingAccess';
import {confirmMarketingSignup} from '@/lib/adminMarketingSignup';
import {verifyMarketingEmail} from '@/lib/adminMarketingEmailVerification';
export async function POST(req:NextRequest){try{const b=await marketingPublicRequest(req,'confirm'),result=confirmMarketingSignup(db,b.token);if(result.emailToVerify)await verifyMarketingEmail(db,result.emailToVerify);return NextResponse.json({confirmed:true},{headers:{'Cache-Control':'no-store'}});}catch(e){return marketingFailure(e);}}
