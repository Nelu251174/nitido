import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminActorId} from '@/lib/adminAuth';
import {operationalReport,type ReportFilters} from '@/lib/operationalReport';
import {MarginError} from '@/lib/operationalMargin';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 if(!await getAdminActorId())return response({error:'Neautorizat'},401);
 try{
  const q=req.nextUrl.searchParams;const filters:ReportFilters={from:q.get('from')??'',to:q.get('to')??''};
  for(const key of ['city','firm','client','mode','space'] as const)filters[key]=q.get(key)??'';
  return response(operationalReport(db,filters));
 }catch(e){return response({error:e instanceof MarginError?e.message:'Raportul nu poate fi calculat. Reîncearcă.'},e instanceof MarginError?e.status:500);}
}
