import {NextRequest,NextResponse} from 'next/server';
import {getAdminIdentity} from '@/lib/adminAuth';
import {hasAdminPermission} from '@/lib/adminRolesShared';
import {db} from '@/lib/db';
import {consumeRateLimit,hasTrustedMutationOrigin} from '@/lib/security';
import {AccountDeletionError,deletionQueue,reviewDeletionRequest} from '@/lib/accountDeletion';
import {readDeletionBody} from '@/lib/accountDeletionHttp';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
const failure=(e:unknown)=>response({error:e instanceof AccountDeletionError?e.message:'Operația nu a fost confirmată.'},e instanceof AccountDeletionError?e.status:503);
async function identity(){return getAdminIdentity();}
export async function GET(req:NextRequest){const actor=await identity();if(!actor)return response({error:'Neautorizat'},401);if(!hasAdminPermission(actor.role,'operations'))return response({error:'Acces interzis'},403);if(!consumeRateLimit('deletion-queue:'+actor.id,60,60000))return response({error:'Prea multe cereri'},429);try{return response(deletionQueue(db,Number(req.nextUrl.searchParams.get('offset')??0)));}catch(e){return failure(e);}}
export async function POST(req:NextRequest){const actor=await identity();if(!actor)return response({error:'Neautorizat'},401);if(!hasAdminPermission(actor.role,'operations'))return response({error:'Acces interzis'},403);if(!req.headers.get('origin')||req.headers.has('authorization')||!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);if(!consumeRateLimit('deletion-review:'+actor.id,20,60000))return response({error:'Prea multe cereri'},429);try{return response(reviewDeletionRequest(db,await readDeletionBody(req,12000),actor.id));}catch(e){return failure(e);}}
