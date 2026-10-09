import {createHash,randomUUID} from 'node:crypto';
import {executionCsv} from '@/lib/executionCsv';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {executionReport,type ExecutionReport} from '@/lib/business';
import {reportFilters,ReportError} from '@/lib/reportArchive';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
const headers={'Cache-Control':'private, no-store'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
function failure(e:unknown){if(e instanceof ReportError)return json({error:e.message},e.status);if(e instanceof Error&&e.message==='REPORT_TOO_LARGE')return json({error:'Raportul depășește 10.000 de lucrări. Restrânge perioada sau locația.'},400);console.error('[reports] operation_failed');return json({error:'Raportul nu a putut fi procesat.'},500)}
function output(report:ExecutionReport,p:URLSearchParams,id?:string){
 if(p.get('format')==='csv')return new NextResponse(executionCsv(report),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="nitido-raport-${id??report.month??report.from??'toate'}.csv"`}});
 return json({report,id});
}
export async function GET(req:NextRequest){
 const user=await getCurrentUser(req);if(!user||user.role!=='client')return json({error:'Autentificare client necesară.'},401);
 const p=new URL(req.url).searchParams;
 try{
  if(p.has('savedId')){
   const id=p.get('savedId')!;if(!/^[a-f0-9-]{36}$/.test(id))throw new ReportError('Raport invalid.');
   const row=db.prepare('SELECT report_json FROM client_report_archive WHERE id=? AND owner_id=?').get(id,user.id) as {report_json:string}|undefined;
   if(!row)throw new ReportError('Raport inexistent.',404);return output(JSON.parse(row.report_json),p,id);
  }
  if(p.get('view')==='catalog')return json({properties:db.prepare(`SELECT p.id,p.name,p.kind,p.archived,op.organization_id,o.name AS organization_name FROM workspace_properties p LEFT JOIN workspace_organization_properties op ON op.property_id=p.id LEFT JOIN workspace_organizations o ON o.id=op.organization_id AND o.owner_id=p.owner_id WHERE p.owner_id=? ORDER BY p.name,p.id`).all(user.id),organizations:db.prepare('SELECT id,name FROM workspace_organizations WHERE owner_id=? ORDER BY name,id').all(user.id)});
  if(p.get('view')==='archive'){
   const f=reportFilters(db,user.id,new URLSearchParams(p.has('organizationId')?{organizationId:p.get('organizationId')!}:{}));
   const page=Number(p.get('page')??0);if(!Number.isSafeInteger(page)||page<0||page>100000)throw new ReportError('Pagină invalidă.');
   const rows=db.prepare('SELECT id,name,created_at AS createdAt FROM client_report_archive WHERE owner_id=? AND (? IS NULL OR organization_id=?) ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ?').all(user.id,f.organizationId,f.organizationId,page*20);
   return json({saved:rows.slice(0,20),hasMore:rows.length>20,page});
  }
  const report=db.transaction(()=>{const f=reportFilters(db,user.id,p);return executionReport(db,user.id,f.month,f)})();return output(report,p);
 }catch(e){return failure(e)}
}
export async function POST(req:NextRequest){
 const user=await getCurrentUser(req);if(!user||user.role!=='client')return json({error:'Autentificare client necesară.'},401);
 if(!hasTrustedMutationOrigin(req))return json({error:'Origine invalidă.'},403);
 if(!consumeRateLimit(`report-save:${user.id}`,10,60000))return json({error:'Reîncearcă salvarea peste un minut.'},429);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>4000)throw new ReportError('Cerere prea mare.',413);
  let b;try{b=JSON.parse(raw)}catch{throw new ReportError('Cerere invalidă.')}
  if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||typeof b.requestKey!=='string'||!/^[a-f0-9-]{36}$/.test(b.requestKey))throw new ReportError('Completează denumirea raportului.');
  const p=new URL(req.url).searchParams;
  const result=db.transaction(()=>{
   const f=reportFilters(db,user.id,p);
   const fingerprint=createHash('sha256').update(JSON.stringify({filters:f,name:b.name.trim()})).digest('hex');
   const existing=db.prepare('SELECT id,report_json,request_fingerprint FROM client_report_archive WHERE owner_id=? AND request_key=?').get(user.id,b.requestKey) as {id:string;report_json:string;request_fingerprint:string}|undefined;
   if(existing){if(existing.request_fingerprint!==fingerprint)throw new ReportError('Cererea de salvare a fost deja folosită pentru alte filtre.',409);return {id:existing.id,report:JSON.parse(existing.report_json)}}
   const report=executionReport(db,user.id,f.month,f),id=randomUUID();
   db.prepare('INSERT INTO client_report_archive(id,owner_id,organization_id,name,created_at,report_json,request_key,request_fingerprint) VALUES(?,?,?,?,?,?,?,?)').run(id,user.id,f.organizationId,b.name.trim(),report.generatedAt,JSON.stringify(report),b.requestKey,fingerprint);
   return {id,report};
  }).immediate();return json(result,201);
 }catch(e){return failure(e)}
}
