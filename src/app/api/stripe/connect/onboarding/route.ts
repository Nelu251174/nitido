import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {createOnboardingLink} from '@/lib/stripeConnect';
import {hasTrustedMutationOrigin} from '@/lib/security';

export async function POST(req:NextRequest){
  const user=await getCurrentUser(req);if(!user||user.role!=='firma')return NextResponse.json({error:'Neautorizat'},{status:401});
  if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:'Origine nepermisă'},{status:403});
  const action=req.headers.get('idempotency-key');
  if(action&&!/^[a-zA-Z0-9-]{16,80}$/.test(action))return NextResponse.json({error:'Identificator invalid'},{status:400});
  const key=action?`nitido-onboarding-${createHash('sha256').update(user.id+':'+action).digest('hex')}`:undefined;
  // Use the configured public origin behind the reverse proxy, never a forwarded host.
  const baseUrl=process.env.NEXT_PUBLIC_SITE_URL??new URL(req.url).origin;
  try{return NextResponse.json({url:await createOnboardingLink(db,user.id,baseUrl,key)});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Onboarding indisponibil'},{status:409});}
}

// Stripe refresh links are browser GET requests. Preserve that return path,
// but require an explicit authenticated POST before creating another link.
export async function GET(req:NextRequest){
  return NextResponse.redirect(new URL('/firma?stripe=refresh-required',process.env.NEXT_PUBLIC_SITE_URL??req.url),303);
}
