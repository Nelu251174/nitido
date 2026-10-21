import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {db} from '@/lib/db';
import {hasTrustedMutationOrigin} from '@/lib/security';
import * as pro from '@/lib/pro/core';
import {FUNNEL_EVENTS,FUNNEL_FIELDS} from '@/lib/bookingFunnelReport';
export async function POST(req:NextRequest){
 try{
  if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:'Origine invalidă.'},{status:403});
  if(process.env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro')return new NextResponse(null,{status:204});
  const raw=await req.text();if(raw.length>600)return new NextResponse(null,{status:413});
  const b=JSON.parse(raw);
  if(!b||typeof b!=='object'||b.consent!==true||typeof b.session!=='string'||!/^[a-f0-9-]{36}$/.test(b.session)||!FUNNEL_EVENTS.includes(b.event)||!['mobile','desktop'].includes(b.device)||(b.field!==undefined&&!FUNNEL_FIELDS.includes(b.field)))return new NextResponse(null,{status:422});
  pro.ready(db);
  pro.limit(db,'funnel:'+createHash('sha256').update(req.headers.get('x-forwarded-for')??'unknown').digest('hex'),80,600000);
  pro.atomic(db,{id:'public-funnel'},b.session+':'+b.event+':'+(b.field??''),{event:b.event,field:b.field,device:b.device},()=>{
   pro.audit(db,{id:'session:'+b.session},null,b.event,'public.booking_funnel',{device:b.device,...(b.field?{field:b.field}:{})});return {recorded:true};
  });
  return new NextResponse(null,{status:204});
 }catch(e){return new NextResponse(null,{status:e instanceof SyntaxError?422:e instanceof pro.ProError?e.status:503});}
}
