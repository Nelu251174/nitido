import {previewPropertyImport,commitPropertyImport} from "@/lib/propertyImport";
import { hasTrustedMutationOrigin } from "@/lib/security";
import { NextRequest,NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db,getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/security";
import { setInventoryThreshold,inventoryHistory,hostInventory,createInventoryItem,moveInventory,teamBlocks,createTeamBlock,cancelTeamBlock,assignTeam,hostChecks,setHostCheck,importCalendar,linkPropertyJob,requireText,saveProperty,setChecklist,WorkspaceError } from "@/lib/workspace";
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(req:NextRequest){
 const user=await getCurrentUser(req);if(!user)return response({error:"Autentificare necesară"},401);
 const firm=user.role==="firma"?getFirmByUserId(user.id):null;
 const properties=user.role==="client"?db.prepare(`SELECT p.*,
 (SELECT COUNT(*) FROM workspace_property_jobs pj JOIN jobs j ON j.id=pj.job_id WHERE pj.property_id=p.id AND j.client_id=p.owner_id) AS jobs_count,
 (SELECT COALESCE(SUM(j.price_gross),0) FROM workspace_property_jobs pj JOIN jobs j ON j.id=pj.job_id WHERE pj.property_id=p.id AND j.client_id=p.owner_id AND j.status='completed' AND strftime('%Y-%m',j.completed_at)=strftime('%Y-%m','now')) AS month_total
 FROM workspace_properties p WHERE p.owner_id=? AND p.archived=0 ORDER BY p.created_at DESC`).all(user.id):[];
 const teams=firm?db.prepare("SELECT * FROM workspace_teams WHERE firm_id=? AND active=1 ORDER BY name").all(firm.id):[];
 const assignments=firm?db.prepare("SELECT a.* FROM workspace_assignments a JOIN workspace_teams t ON t.id=a.team_id WHERE t.firm_id=?").all(firm.id):[];
 const checklist=db.prepare("SELECT c.* FROM workspace_checklist c JOIN jobs j ON j.id=c.job_id LEFT JOIN firms f ON f.id=j.accepted_firm_id WHERE j.client_id=? OR f.user_id=?").all(user.id,user.id);
 const events=user.role==="client"?db.prepare("SELECT e.*,p.name AS property_name FROM workspace_calendar_events e JOIN workspace_properties p ON p.id=e.property_id WHERE p.owner_id=? AND p.archived=0 ORDER BY e.starts_at").all(user.id):[];
 const propertyJobs=user.role==="client"?db.prepare(`SELECT pj.* FROM workspace_property_jobs pj JOIN workspace_properties p ON p.id=pj.property_id JOIN jobs j ON j.id=pj.job_id WHERE p.owner_id=? AND j.client_id=? AND p.archived=0`).all(user.id,user.id):[];
 const firms=user.role==='client'?db.prepare(`SELECT DISTINCT f.id,u.name FROM firms f JOIN users u ON u.id=f.user_id JOIN jobs j ON j.accepted_firm_id=f.id WHERE j.client_id=? ORDER BY u.name`).all(user.id):[];
 return response({firms,inventoryHistory:user.role==="client"?inventoryHistory(db,user.id):[],inventory:user.role==="client"?hostInventory(db,user.id):[],blocks:firm?teamBlocks(db,user.id):[],properties,teams,assignments,checklist,events,propertyJobs,hostChecks:user.role==="client"?hostChecks(db,user.id):[]});
}
export async function POST(req:NextRequest){
 const user=await getCurrentUser(req);if(!user)return response({error:"Autentificare nécessaire"},401);
 // Cookie requests must be same-origin; bearer requests are separately authenticated.
 if(!hasTrustedMutationOrigin(req))return response({error:"Origine invalidă"},403);
 if(!consumeRateLimit(`workspace:${user.id}`,60,60000))return response({error:"Prea multe cereri. Reîncearcă într-un minut."},429);
 try{
  if(Number(req.headers.get("content-length")??0)>1_100_000)throw new WorkspaceError("Cerere prea mare",413);
  const raw=await req.text();if(Buffer.byteLength(raw)>1_100_000)throw new WorkspaceError("Cerere prea mare",413);
  const b=JSON.parse(raw) as Record<string,unknown>;
  if(!b||typeof b!=="object")throw new WorkspaceError("Cerere invalidă");
  switch(b.action){
   case "inventory.create":if(user.role!=="client")throw new WorkspaceError("Acces interzis",403);return response({id:createInventoryItem(db,user.id,requireText(b.propertyId,"Proprietate"),requireText(b.name,"Articol",100),requireText(b.unit,"Unitate",30),Number(b.threshold))});
   case "inventory.threshold":if(user.role!=="client")throw new WorkspaceError("Acces interzis",403);setInventoryThreshold(db,user.id,requireText(b.itemId,"Articol"),Number(b.threshold));break;
   case "inventory.move":if(user.role!=="client")throw new WorkspaceError("Acces interzis",403);moveInventory(db,user.id,requireText(b.itemId,"Articol"),Number(b.delta),requireText(b.note,"Motiv"),requireText(b.requestKey,"Identificator",100));break;
   case "host.check":if(user.role!=="client")throw new WorkspaceError("Acces interzis",403);if(typeof b.done!=="boolean")throw new WorkspaceError("Stare invalidă");setHostCheck(db,user.id,requireText(b.eventId,"Sejur"),requireText(b.turnoverAt,"Eliberare"),requireText(b.key,"Verificare"),b.done);break;
   case "property.preview":if(user.role!=="client")throw new WorkspaceError("Acces interzis",403);return response(previewPropertyImport(db,user.id,b.csv));
   case "property.import":if(user.role!=="client")throw new WorkspaceError("Acces interzis",403);return response(commitPropertyImport(db,user.id,b.csv));
   case "property.save":if(user.role!=="client")throw new WorkspaceError("Acces interzis",403);return response({id:saveProperty(db,user.id,b)});
   case "property.link":if(user.role!=="client")throw new WorkspaceError("Acces interzis",403);linkPropertyJob(db,user.id,requireText(b.propertyId,"Proprietate"),requireText(b.jobId,"Lucrare"));break;
   case "calendar.import":if(user.role!=="client")throw new WorkspaceError("Acces interzis",403);return response({count:importCalendar(db,user.id,requireText(b.propertyId,"Proprietate"),requireText(b.source,"Sursă"),requireText(b.ical,"Calendar",1_000_000))});
   case "team.create":{
    const firm=getFirmByUserId(user.id);if(user.role!=="firma"||!firm)throw new WorkspaceError("Acces interzis",403);
    const name=requireText(b.name,"Nume echipă",80);db.prepare("INSERT INTO workspace_teams(id,firm_id,name) VALUES(?,?,?)").run(randomUUID(),firm.id,name);break;
   }
   case "team.block":if(user.role!=="firma")throw new WorkspaceError("Acces interzis",403);return response({id:createTeamBlock(db,user.id,requireText(b.teamId,"Echipă"),requireText(b.startsAt,"Început"),requireText(b.endsAt,"Sfârșit"),requireText(b.reason,"Motiv",160))});
   case "team.unblock":if(user.role!=="firma")throw new WorkspaceError("Acces interzis",403);cancelTeamBlock(db,user.id,requireText(b.id,"Interval"));break;
   case "team.assign":assignTeam(db,user.id,requireText(b.teamId,"Echipă"),requireText(b.jobId,"Lucrare"));break;
   case "checklist.set":if(typeof b.done!=="boolean")throw new WorkspaceError("Stare invalidă");setChecklist(db,user.id,requireText(b.jobId,"Lucrare"),requireText(b.key,"Verificare"),b.done);break;
   default:throw new WorkspaceError("Acțiune invalidă");
  }
  return response({ok:true});
 }catch(e){if(e instanceof WorkspaceError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:"Cerere invalidă"},400);console.error("[workspace] operation_failed");return response({error:"Operația nu a putut fi salvată. Reîncearcă."},500)}
}
