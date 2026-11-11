import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminIdentity,auditAdminAction} from '@/lib/adminAuth';
import {hasAdminPermission} from '@/lib/adminRolesShared';
import {hasTrustedAdminOrigin} from '@/lib/adminMfa';
import {consumeRateLimit} from '@/lib/security';
import {InternationalTariffError,internationalReviewEnabled,internationalTariffOverview,parseInternationalTariff,internationalTariffBlockers,saveInternationalTariffDraft} from '@/lib/internationalTariffs';
import {previewInternationalTariff} from '@/lib/internationalBooking';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 const actor=await getAdminIdentity();if(!actor)return reply({error:'Neautorizat'},401);
 if(!hasAdminPermission(actor.role,'manage'))return reply({error:'Acces interzis'},403);
 if(!consumeRateLimit('international-tariffs-read:'+actor.id,60,60000))return reply({error:'Prea multe cereri.'},429);
 try{return reply(internationalTariffOverview(db));}catch{return reply({error:'Registrul nu a putut fi citit. Nicio configurație nu a fost modificată.'},500);}
}
export async function POST(req:NextRequest){
 const actor=await getAdminIdentity();if(!actor)return reply({error:'Neautorizat'},401);
 if(!hasAdminPermission(actor.role,'manage'))return reply({error:'Acces interzis'},403);
 if(!hasTrustedAdminOrigin(req)||req.headers.has('authorization'))return reply({error:'Origine invalidă'},403);
 if(!internationalReviewEnabled())return reply({error:'Revizia este disponibilă numai în mediul izolat autorizat.'},403);
 if(!consumeRateLimit('international-tariffs-write:'+actor.id,20,60000))return reply({error:'Prea multe cereri.'},429);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>40000)return reply({error:'Cerere prea mare'},413);const body=JSON.parse(raw);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new InternationalTariffError('Cerere invalidă.');
  if(!['validate','preview','saveDraft'].includes(body.action))throw new InternationalTariffError('Această revizie nu permite aprobarea sau activarea tarifelor.');
  const definition=parseInternationalTariff(body.definition),blockers=internationalTariffBlockers(definition);
  if(body.action==='validate')return reply({definition,blockers});
  if(body.action==='preview')return reply({definition,blockers,preview:previewInternationalTariff(definition,body.input)});
  const tariff=db.transaction(()=>{const saved=saveInternationalTariffDraft(db,body.id,body.revision,definition,actor.id);auditAdminAction('international_tariff.draft_saved',saved.id,{revision:saved.revision,countryCode:definition.countryCode});return saved;}).immediate();
  return reply({tariff,...internationalTariffOverview(db)});
 }catch(error){
  if(error instanceof InternationalTariffError)return reply({error:error.message},error.status);
  if(error instanceof SyntaxError)return reply({error:'Date invalide.'},400);
  return reply({error:'Operațiunea nu a fost confirmată. Reîncarcă registrul înainte de reîncercare.'},500);
 }
}
