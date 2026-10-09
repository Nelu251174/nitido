import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminIdentity,auditAdminAction} from '@/lib/adminAuth';
import {customerPermissions,customerRecordView} from '@/lib/customerAccess';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {WorkspaceError} from '@/lib/workspace';
import {customerDirectory,customerRecord,changeCustomerOperations} from '@/lib/customerOperations';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const failure=(e:unknown)=>response({error:e instanceof WorkspaceError?e.message:e instanceof SyntaxError?'Date invalide.':'Fișa nu a putut fi procesată. Reîncearcă.'},e instanceof WorkspaceError?e.status:e instanceof SyntaxError?400:500);
export async function GET(req:NextRequest){const identity=await getAdminIdentity();if(!identity)return response({error:'Neautorizat'},401);if(!customerPermissions(identity.role).read)return response({error:'Acces interzis'},403);try{const q=req.nextUrl.searchParams,id=q.get('clientId'),offset=Number(q.get('offset')??0);return response(id?customerRecordView(customerRecord(db,id,offset),identity.role):customerDirectory(db,q.get('q')??'',offset));}catch(e){return failure(e);}}
export async function POST(req:NextRequest){const identity=await getAdminIdentity();if(!identity)return response({error:'Neautorizat'},401);if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);try{const raw=await req.text();if(Buffer.byteLength(raw)>18000)return response({error:'Cerere prea mare'},413);const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw new WorkspaceError('Date invalide.');const permissions=customerPermissions(identity.role);if(b.action==='restrict'?!permissions.restrict:!permissions.annotate)return response({error:'Rolul nu permite această modificare'},403);const result=db.transaction(()=>{const r=changeCustomerOperations(db,b,identity.id);auditAdminAction('customer.'+b.action,r.clientId,{actorId:identity.id,...r});return r;}).immediate();return response({result});}catch(e){return failure(e);}}
