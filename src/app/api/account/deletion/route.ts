import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {consumeRateLimit} from '@/lib/security';
import {AccountDeletionError,DELETION_REQUEST_MESSAGE,getDeletionRequest,requestAccountDeletion} from '@/lib/accountDeletion';
import {deletionMutationOrigin,readDeletionBody} from '@/lib/accountDeletionHttp';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
const failure=(e:unknown)=>response({error:e instanceof AccountDeletionError?e.message:'Cererea nu a fost confirmată. Reîncearcă.'},e instanceof AccountDeletionError?e.status:503);
export async function GET(req:NextRequest){const user=await getCurrentUser(req);if(!user)return response({error:'Autentificare necesară.'},401);if(!consumeRateLimit('account-deletion-read:'+user.id,60,60000))return response({error:'Prea multe cereri.'},429);try{return response({request:getDeletionRequest(db,user.id),message:DELETION_REQUEST_MESSAGE});}catch(e){return failure(e);}}
export async function POST(req:NextRequest){const user=await getCurrentUser(req);if(!user)return response({error:'Autentificare necesară.'},401);if(!deletionMutationOrigin(req))return response({error:'Origine invalidă.'},403);if(!consumeRateLimit('account-deletion-write:'+user.id,5,60000))return response({error:'Prea multe cereri. Reîncearcă într-un minut.'},429);try{const b=await readDeletionBody(req);if(!b||typeof b!=='object'||Array.isArray(b)||b.confirmation!=='DELETE_ACCOUNT'||Object.keys(b).some(k=>k!=='confirmation'))throw new AccountDeletionError('Confirmă explicit ștergerea contului tău.');const result=requestAccountDeletion(db,user.id);return response({...result,message:DELETION_REQUEST_MESSAGE},result.replayed?200:201);}catch(e){return failure(e);}}
