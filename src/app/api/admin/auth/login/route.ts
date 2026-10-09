import {NextRequest,NextResponse} from 'next/server';
import {authenticateAdmin,adminAuthConfigured,auditAdminAction} from '@/lib/adminAuth';
import {consumeAdminLoginAttempt,hasTrustedAdminOrigin} from '@/lib/adminMfa';
import {consumeRateLimit,requestIp} from '@/lib/security';
import {db} from '@/lib/db';

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest){
  if(!hasTrustedAdminOrigin(req))return reply({error:'Origine nepermisă'},403);
  if(!adminAuthConfigured())return reply({error:'Autentificarea administrativă necesită configurare securizată.'},503);
  if(!consumeRateLimit(`admin-login:${requestIp(req)}`,5,15*60000)||!consumeAdminLoginAttempt(db))return reply({error:'Prea multe încercări. Reîncearcă după 15 minute.'},429);
  const text=await req.text();if(text.length>4096)return reply({error:'Cerere invalidă'},400);
  let body;try{body=JSON.parse(text);}catch{return reply({error:'Cerere invalidă'},400);}
  if(!body||typeof body.email!=='string'||body.email.length>254||typeof body.password!=='string'||body.password.length>1024||typeof body.code!=='string'||body.code.length>32||!['totp','recovery'].includes(body.method))return reply({error:'Cerere invalidă'},400);
  try{
    if(!(await authenticateAdmin(body.email,body.password,body.code,body.method))){
      auditAdminAction('ADMIN_LOGIN_REJECTED',null);
      return reply({error:'Emailul, parola sau codul nu sunt valide.'},401);
    }
    return reply({ok:true});
  }catch{return reply({error:'Autentificarea nu a putut fi confirmată. Reîncearcă folosind un cod nou.'},503);}
}
