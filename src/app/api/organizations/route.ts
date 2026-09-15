import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
import {organizationSnapshot,saveOrganizationModules,saveOrganization,assignOrganizationProperty,inviteOrganization,revokeOrganizationAccess,OrganizationError} from '@/lib/organizations';
const response=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const user=await getCurrentUser(req);if(!user||user.role!=='client')return response({error:'Intră într-un cont client.'},403);
 return response({organizations:organizationSnapshot(db,user.id),availableProperties:db.prepare(`SELECT p.id,p.name,p.kind FROM workspace_properties p WHERE owner_id=? AND kind IN ('business','host') AND archived=0 AND NOT EXISTS(SELECT 1 FROM workspace_organization_properties op WHERE op.property_id=p.id) ORDER BY p.name`).all(user.id)});
}
export async function POST(req:NextRequest){
 const user=await getCurrentUser(req);if(!user||user.role!=='client')return response({error:'Intră într-un cont client.'},403);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă.'},403);
 if(!consumeRateLimit(`organizations:${user.id}`,40,60000))return response({error:'Prea multe cereri. Reîncearcă într-un minut.'},429);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>20000)return response({error:'Cerere prea mare.'},413);
  const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw new OrganizationError('Cerere invalidă.');
  const id=(key:string)=>{if(typeof b[key]!=='string'||!b[key]||b[key].length>100)throw new OrganizationError('Identificator invalid.');return b[key] as string};
  switch(b.action){
   case 'modules.save':saveOrganizationModules(db,user.id,id('organizationId'),b);break;
   case 'save':return response({id:saveOrganization(db,user.id,b)});
   case 'property.attach':case 'property.detach':assignOrganizationProperty(db,user.id,id('organizationId'),id('propertyId'),b.action==='property.attach');break;
   case 'invite':return response(inviteOrganization(db,user.id,id('organizationId'),b.email,b.role));
   case 'member.revoke':case 'invite.revoke':revokeOrganizationAccess(db,user.id,id('organizationId'),id('id'),b.action==='member.revoke'?'member':'invite');break;
   default:throw new OrganizationError('Acțiune invalidă.');
  }
  return response({ok:true});
 }catch(e){if(e instanceof OrganizationError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă.'},400);console.error('[organizations] operation_failed');return response({error:'Modificarea nu a putut fi salvată.'},500)}
}
