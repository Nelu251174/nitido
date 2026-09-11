import { after, NextRequest,NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/security";
import { AccessError,acceptInvite,createInvite,revokeMember,resourceOwner,createApproval,decideApproval,executionAccess,submitExecutionReport } from "@/lib/collaborationAccess";
import { setChecklist,WorkspaceError,requireText } from "@/lib/workspace";
import { markArrivedWithProof } from "@/lib/proofOfWork";
import { processPushOutbox,queueArrivedClientPush } from "@/lib/push";
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(req:NextRequest){
 const user=await getCurrentUser(req);if(!user)return response({error:"Autentificare necesară"},401);
 const resources=db.prepare(`SELECT 'team' kind,t.id,t.name,'owner' role FROM workspace_teams t JOIN firms f ON f.id=t.firm_id WHERE f.user_id=? AND t.active=1
 UNION ALL SELECT 'property',p.id,p.name,CASE WHEN p.owner_id=? THEN 'owner' ELSE m.role END FROM workspace_properties p LEFT JOIN workspace_members m ON m.kind='property' AND m.resource_id=p.id AND m.user_id=? AND m.active=1 WHERE p.archived=0 AND (p.owner_id=? OR m.id IS NOT NULL)`).all(user.id,user.id,user.id,user.id) as {kind:string;id:string;name:string;role:string}[];
 const owned=resources.filter(r=>r.role==='owner');
 const members=owned.flatMap(r=>db.prepare("SELECT m.id,m.resource_id,m.role,u.name,u.email FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE m.kind=? AND m.resource_id=? AND m.active=1").all(r.kind,r.id));
 const invites=owned.flatMap(r=>db.prepare("SELECT id,resource_id,email,role,expires_at FROM workspace_invites WHERE kind=? AND resource_id=? AND revoked=0 AND accepted_by IS NULL AND expires_at>?").all(r.kind,r.id,new Date().toISOString()));
 const properties=resources.filter(r=>r.kind==='property').map(r=>({...db.prepare("SELECT id,name,street,city,sqm,space_type,budget_bani,budget_enforced FROM workspace_properties WHERE id=?").get(r.id) as object,role:r.role}));
 const approvals=resources.filter(r=>r.kind==='property').flatMap(r=>db.prepare("SELECT a.*,u.name requester_name FROM workspace_approvals a JOIN users u ON u.id=a.requested_by WHERE a.property_id=? ORDER BY a.created_at DESC LIMIT 100").all(r.id));
 // Deliberate projection: worker responses contain no prices, credits, payment identifiers or client contact details.
 const jobs=db.prepare(`SELECT j.id,j.street,j.city,j.sqm,j.space_type,j.status,j.scheduled_at,j.details,j.duration_minutes FROM jobs j JOIN firms f ON f.id=j.accepted_firm_id WHERE j.status IN ('accepted','arrived') AND (f.user_id=? OR EXISTS(SELECT 1 FROM workspace_assignments a JOIN workspace_teams t ON t.id=a.team_id JOIN workspace_members m ON m.kind='team' AND m.resource_id=t.id WHERE a.job_id=j.id AND t.firm_id=j.accepted_firm_id AND t.active=1 AND m.user_id=? AND m.active=1 AND m.role='worker')) ORDER BY j.scheduled_at`).all(user.id,user.id) as {id:string}[];
 const execution=jobs.map(j=>({...j,checklist:db.prepare("SELECT item_key,done FROM workspace_checklist WHERE job_id=?").all(j.id),photos:db.prepare("SELECT id,proof_type FROM job_photos WHERE job_id=? AND status='VALID'").all(j.id),report:db.prepare("SELECT note,submitted_at FROM workspace_execution_reports WHERE job_id=?").get(j.id)??null}));
 return response({resources,members,invites,properties,approvals,jobs:execution});
}
export async function POST(req:NextRequest){
 const user=await getCurrentUser(req);if(!user)return response({error:"Autentificare necesară"},401);
 const origin=req.headers.get('origin');if(origin&&origin!==req.nextUrl.origin&&!req.headers.get('authorization'))return response({error:"Origine invalidă"},403);
 if(!consumeRateLimit(`collaboration:${user.id}`,60,60000))return response({error:"Prea multe cereri. Reîncearcă într-un minut."},429);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>20000)throw new AccessError("Cerere prea mare",413);
  const b=JSON.parse(raw);if(!b||typeof b!=="object"||Array.isArray(b))throw new AccessError("Cerere invalidă");
  const str=(k:string)=>requireText(b[k],k,2000);
  switch(b.action){
   case 'invite.create':return response(createInvite(db,user.id,str('kind'),str('resourceId'),str('email'),str('role')));
   case 'invite.accept':return response(acceptInvite(db,user.id,str('token')));
   case 'member.revoke':revokeMember(db,user.id,str('id'));break;
   case 'invite.revoke':{const i=db.prepare("SELECT kind,resource_id FROM workspace_invites WHERE id=?").get(str('id')) as {kind:string;resource_id:string}|undefined;if(!i||resourceOwner(db,i.kind,i.resource_id)!==user.id)throw new AccessError('Acces interzis',403);db.prepare("UPDATE workspace_invites SET revoked=1 WHERE id=?").run(b.id);break;}
   case 'approval.request':return response({id:createApproval(db,user.id,{propertyId:str('propertyId'),date:str('date'),note:typeof b.note==='string'?b.note:'',requestKey:str('requestKey')})});
   case 'approval.decide':if(typeof b.approve!=='boolean')throw new AccessError('Decizie invalidă');decideApproval(db,user.id,str('id'),b.approve,typeof b.note==='string'?b.note:'');break;
   case 'budget.configure':if(resourceOwner(db,'property',str('propertyId'))!==user.id)throw new AccessError('Acces interzis',403);if(typeof b.enabled!=='boolean')throw new AccessError('Stare invalidă');db.prepare("UPDATE workspace_properties SET budget_enforced=? WHERE id=?").run(b.enabled?1:0,b.propertyId);break;
   case 'checklist.set':if(typeof b.done!=='boolean')throw new AccessError('Stare invalidă');setChecklist(db,user.id,str('jobId'),str('key'),b.done);break;
   case 'execution.arrived':{const id=str('jobId'),access=executionAccess(db,user.id,id);if(!access)throw new AccessError('Acces interzis',403);const result=markArrivedWithProof(db,id,access.firm_id,user.id);if(!result.ok)throw new AccessError(result.error,result.status);try{const ids=queueArrivedClientPush(db,id);if(ids.length)after(()=>processPushOutbox(db,ids))}catch{console.error('[collaboration] push_enqueue_failed')}break;}
   case 'execution.submit':submitExecutionReport(db,user.id,str('jobId'),typeof b.note==='string'?b.note:'');break;
   default:throw new AccessError('Acțiune invalidă');
  }
  return response({ok:true});
 }catch(e){if(e instanceof AccessError||e instanceof WorkspaceError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);console.error('[collaboration] operation_failed');return response({error:'Operația nu a putut fi salvată.'},500)}
}
