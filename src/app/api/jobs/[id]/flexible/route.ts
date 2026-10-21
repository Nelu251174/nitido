import {NextRequest,NextResponse} from 'next/server';
import {db,getFirmByUserId} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {canPreviewOpportunity} from '@/lib/opportunityEligibility';
import {flexibleContext,saveFlexiblePreferences,clearFlexiblePreferences,FlexibleError} from '@/lib/flexibleScheduling';
import type {JobRow} from '@/lib/types';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(req);if(!user)return reply({error:'Autentificare necesară'},401);const {id}=await params;
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as JobRow|undefined;
 const firm=user.role==='firma'?getFirmByUserId(user.id):null;
 if(!job||!(user.role==='client'&&job.client_id===user.id||firm&&canPreviewOpportunity(db,firm.id,job)))return reply({error:'Lucrare inexistentă'},404);
 const mine=firm?db.prepare('SELECT d.* FROM flexible_offer_details d JOIN offers o ON o.id=d.offer_id WHERE o.job_id=? AND o.firm_id=?').get(id,firm.id):null;
 return reply({flexible:flexibleContext(db,id),proposal:mine,teams:firm?db.prepare('SELECT id,name FROM workspace_teams WHERE firm_id=? AND active=1 ORDER BY name').all(firm.id):[]});
}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(req);if(!user||user.role!=='client')return reply({error:'Autentificare client necesară'},401);
 if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);const {id}=await params,b=await req.json().catch(()=>({}));
 try{
  if(b.action==='reject'){
   db.transaction(()=>{const job=db.prepare("SELECT id FROM jobs WHERE id=? AND client_id=? AND status='waiting'").get(id,user.id);if(!job)throw new FlexibleError('Cerere inexistentă sau deja confirmată.',404);const offer=db.prepare("SELECT id FROM offers WHERE id=? AND job_id=? AND status='pending'").get(b.offerId,id);if(!offer)throw new FlexibleError('Propunere indisponibilă.');db.prepare("UPDATE offers SET status='rejected' WHERE id=?").run(b.offerId);db.prepare("UPDATE flexible_offer_details SET status='rejected' WHERE offer_id=?").run(b.offerId);}).immediate();
  }else if(b.action==='fixed')clearFlexiblePreferences(db,id,user.id);
  else saveFlexiblePreferences(db,id,user.id,b.windows);
  return reply({ok:true,flexible:flexibleContext(db,id)});
 }catch(e){return reply({error:e instanceof Error?e.message:'Preferințele nu au fost salvate.'},e instanceof FlexibleError?e.status:400);}
}
