import {NextResponse} from 'next/server';
import {access} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {db} from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
/** Disponibilitate locală; fără apeluri financiare, date de cont sau scrieri. */
export async function GET(){
 try{
  db.prepare('SELECT id,status FROM jobs LIMIT 1').get();
  db.prepare('SELECT id FROM users LIMIT 1').get();
  db.prepare('SELECT id,report_json FROM client_report_archive LIMIT 0').all();
  db.prepare('SELECT organization_id,business,host,ical FROM workspace_organization_modules LIMIT 0').all();
  await Promise.all([access(path.join(process.cwd(),'data'),constants.R_OK|constants.W_OK),access(path.join(process.cwd(),'public','uploads'),constants.R_OK|constants.W_OK)]);
  return NextResponse.json({status:'ok'},{headers});
 }catch{return NextResponse.json({status:'unavailable'},{status:503,headers})}
}
