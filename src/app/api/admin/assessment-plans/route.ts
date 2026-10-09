import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {manualOffersEnabled} from '@/lib/manualOffers';
import {MarginError} from '@/lib/operationalMargin';
import {CatalogError} from '@/lib/serviceCatalog';
import {listAssessmentPlans,planAssessment,saveAssessmentPlan} from '@/lib/assessmentPlan';
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 if(!await getAdminActorId('operations'))return response({error:'Neautorizat'},401);
 try{const a=planAssessment(db,req.nextUrl.searchParams.get('id'));return response({plans:listAssessmentPlans(db,a.id),assessmentVersion:a.version,enabled:manualOffersEnabled()&&!process.env.STRIPE_SECRET_KEY?.startsWith('rk_live_')});}
 catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);throw e;}
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId('operations');if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 if(!manualOffersEnabled()||process.env.STRIPE_SECRET_KEY?.startsWith('rk_live_'))return response({error:'Planificarea este disponibilă numai în sandbox după activare.'},403);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>10000)return response({error:'Cerere prea mare'},413);
  const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))return response({error:'Cerere invalidă'},400);
  const plan=db.transaction(()=>{const result=saveAssessmentPlan(db,input,actor);auditAdminAction('assessment.plan_saved',input.id,{actorId:actor,revision:result.revision,assessmentVersion:result.assessment_version});return result;}).immediate();
  return response({plan});
 }catch(e){if(e instanceof MarginError||e instanceof CatalogError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);return response({error:'Planul nu a fost confirmat. Actualizează istoricul înainte de reîncercare.'},500);}
}
