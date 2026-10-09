import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit,hasTrustedMutationOrigin,requestIp} from '@/lib/security';
import {emailIsVerified,confirmEmailVerification,sendVerificationEmail} from '@/lib/emailVerification';
import {emailConfigured} from '@/lib/email';
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){const user=await getCurrentUser(req);if(!user)return response({error:'Autentificare necesară'},401);return response({verified:emailIsVerified(db,user.id),configured:emailConfigured()})}
export async function POST(req:NextRequest){
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 if(!consumeRateLimit(`verify-email-ip:${requestIp(req)}`,30,60000))return response({error:'Prea multe cereri'},429);
 const raw=await req.text();if(Buffer.byteLength(raw)>2000)return response({error:'Cerere prea mare'},413);
 let b;try{b=JSON.parse(raw)}catch{return response({error:'Cerere invalidă'},400)}
 if(!b||typeof b!=='object'||Array.isArray(b))return response({error:'Cerere invalidă'},400);
 if(b.action==='confirm'){if(!confirmEmailVerification(db,b.token))return response({error:'Link invalid, expirat sau deja folosit. Solicită un link nou din cont.'},400);return response({verified:true})}
 if(b.action!=='resend')return response({error:'Acțiune invalidă'},400);
 const user=await getCurrentUser(req);if(!user)return response({error:'Autentificare necesară'},401);
 if(emailIsVerified(db,user.id))return response({verified:true});
 if(!consumeRateLimit(`verify-email-user:${user.id}`,3,3600000))return response({error:'Ai solicitat deja trei mesaje. Reîncearcă peste o oră.'},429);
 if(!await sendVerificationEmail(db,user.id))return response({error:'Emailul nu a putut fi trimis. Serviciul poate fi neconfigurat sau temporar indisponibil.'},503);
 return response({accepted:true});
}
