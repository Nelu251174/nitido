import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {repeatBookingValues,RetentionError} from '@/lib/clientRetention';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const u=await getCurrentUser(req,{readOnly:true});if(u?.role!=='client')return NextResponse.json({error:'Autentificare client necesară'},{status:401});
  try{return NextResponse.json({draft:repeatBookingValues(db,u.id,(await params).id)},{headers:{'Cache-Control':'private, no-store'}});}
  catch(e){if(e instanceof RetentionError)return NextResponse.json({error:e.message},{status:e.status,headers:{'Cache-Control':'private, no-store'}});throw e;}
}
