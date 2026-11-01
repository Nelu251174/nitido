import {NextRequest,NextResponse} from 'next/server';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {db} from '@/lib/db';
import {hasTrustedAdminOrigin} from '@/lib/adminMfa';
import {calculateInternationalCost,INTERNATIONAL_MARKETS,InternationalCostError} from '@/lib/adminInternationalCosts';
import {listInternationalDrafts,saveInternationalDraft} from '@/lib/adminInternationalCostDrafts';
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 if(!await getAdminActorId('finance'))return response({error:'Neautorizat'},401);
 try{return response({drafts:listInternationalDrafts(db),markets:INTERNATIONAL_MARKETS,activationAvailable:false,romaniaUnchanged:true});}
 catch{return response({error:'Registrul nu a putut fi încărcat.'},500);}
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId('finance');if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedAdminOrigin(req))return response({error:'Origine invalidă'},403);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>24000)return response({error:'Cerere prea mare'},413);
  const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'Cerere invalidă'},400);
  if(body.action==='simulate')return response({calculation:calculateInternationalCost(body.input),activationAvailable:false});
  if(body.action!=='save')return response({error:'Registrul permite doar simularea și salvarea în pregătire.'},400);
  const result=db.transaction(()=>{
   const result=saveInternationalDraft(db,body.id,body.revision,body.input,actor);
   if(result.changed)auditAdminAction('international_cost.draft_saved',result.draft.id,{revision:result.draft.revision,country:result.draft.input.countryCode,modelVersion:result.draft.calculation.modelVersion});
   return result;
  }).immediate();
  return response({draft:result.draft,activationAvailable:false,romaniaUnchanged:true});
 }catch(e){
  if(e instanceof InternationalCostError)return response({error:e.message},e.status);
  if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);
  return response({error:'Salvarea nu a fost confirmată. Reîncarcă registrul înainte de reîncercare.'},500);
 }
}
