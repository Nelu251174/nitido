import { NextRequest,NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {hasTrustedMutationOrigin} from "@/lib/security";
import { createVerifiedReview } from "@/lib/reviews";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser(req);
  if(!user||user.role!=="client") return NextResponse.json({error:"Trebuie să fii autentificat ca client"},{status:401});
  if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:"Origine invalidă"},{status:403});
  const {id}=await params; const body=await req.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Evaluare invalidă"},{status:400});
  const result=createVerifiedReview(db,{jobId:id,clientId:user.id,rating:Number(body.stars),reviewText:body.reviewText??body.comment,punctuality:body.punctuality,quality:body.quality,communication:body.communication});
  if(!result.ok) return NextResponse.json({error:result.error},{status:result.status});
  return NextResponse.json({ok:true,id:result.id,verifiedJob:true,badge:"Recenzie verificată"},{status:201});
}
