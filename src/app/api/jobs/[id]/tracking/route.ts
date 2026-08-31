import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientCanReadJob, firmCanReadFullJob } from "@/lib/authorization";
import { db, getFirmByUserId } from "@/lib/db";
import type { JobRow } from "@/lib/types";

type LocationBody={latitude?:unknown;longitude?:unknown;accuracy?:unknown};
const finite=(value:unknown)=>typeof value==="number"&&Number.isFinite(value);

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser(req);if(!user)return NextResponse.json({error:"Autentificare necesară"},{status:401});
  const {id}=await params;const job=db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as JobRow|undefined;if(!job)return NextResponse.json({error:"Lucrare inexistentă"},{status:404});
  const firm=user.role==="firma"?getFirmByUserId(user.id):null;
  const allowed=(user.role==="client"&&clientCanReadJob(user.id,job))||Boolean(firm&&firmCanReadFullJob(firm.id,job));
  if(!allowed)return NextResponse.json({error:"Acces interzis"},{status:403});
  if(job.status!=="arrived")return NextResponse.json({active:false,location:null,status:job.status});
  const location=db.prepare("SELECT latitude,longitude,accuracy,updated_at updatedAt FROM job_live_locations WHERE job_id=? AND firm_id=? AND updated_at>=datetime('now','-2 minutes')").get(id,job.accepted_firm_id)??null;
  return NextResponse.json({active:Boolean(location),location,status:job.status});
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser(req);if(!user||user.role!=="firma")return NextResponse.json({error:"Autentificare Firmă necesară"},{status:401});
  const firm=getFirmByUserId(user.id);const {id}=await params;const job=db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as JobRow|undefined;
  if(!job)return NextResponse.json({error:"Lucrare inexistentă"},{status:404});
  if(!firm||!firmCanReadFullJob(firm.id,job))return NextResponse.json({error:"Acces interzis"},{status:403});
  if(job.status!=="arrived")return NextResponse.json({error:"Localizarea poate fi transmisă numai în timpul lucrării active"},{status:409});
  const body=await req.json().catch(()=>null) as LocationBody|null;if(!body||!finite(body.latitude)||!finite(body.longitude))return NextResponse.json({error:"Locație invalidă"},{status:400});
  const latitude=Number(body.latitude),longitude=Number(body.longitude),accuracy=finite(body.accuracy)?Number(body.accuracy):null;
  if(latitude < -90||latitude > 90||longitude < -180||longitude > 180||accuracy!==null&&(accuracy<0||accuracy>10000))return NextResponse.json({error:"Locație invalidă"},{status:400});
  db.prepare(`INSERT INTO job_live_locations(job_id,firm_id,user_id,latitude,longitude,accuracy) VALUES(?,?,?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET firm_id=excluded.firm_id,user_id=excluded.user_id,latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,updated_at=datetime('now')`).run(id,firm.id,user.id,latitude,longitude,accuracy);
  return NextResponse.json({ok:true});
}

export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser(req);if(!user||user.role!=="firma")return NextResponse.json({error:"Autentificare Firmă necesară"},{status:401});
  const firm=getFirmByUserId(user.id);const {id}=await params;const job=db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as JobRow|undefined;
  if(!job)return NextResponse.json({error:"Lucrare inexistentă"},{status:404});if(!firm||job.accepted_firm_id!==firm.id)return NextResponse.json({error:"Acces interzis"},{status:403});
  db.prepare("DELETE FROM job_live_locations WHERE job_id=? AND firm_id=?").run(id,firm.id);return NextResponse.json({ok:true});
}
