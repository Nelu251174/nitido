import {NextRequest,NextResponse} from 'next/server';
import {isAdmin,auditAdminAction} from '@/lib/adminAuth';
import {db} from '@/lib/db';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {AssessmentError,listAssessments,updateAssessment} from '@/lib/assessments';
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){if(!await isAdmin())return response({error:'Neautorizat'},401);return response({requests:listAssessments(db,null)});}
export async function POST(req:NextRequest){if(!await isAdmin())return response({error:'Neautorizat'},401);if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);try{const raw=await req.text();if(Buffer.byteLength(raw)>20000)return response({error:'Cerere prea mare'},413);const b=JSON.parse(raw);if(!b||typeof b!=='object')return response({error:'Cerere invalidă'},400);db.transaction(()=>{updateAssessment(db,{admin:true},b.id,b.version,b.action,b.body);auditAdminAction('assessment.review',b.id,{status:b.action})})();return response({ok:true})}catch(e){if(e instanceof AssessmentError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);throw e}}
