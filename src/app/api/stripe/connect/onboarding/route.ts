import {NextRequest,NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {db} from "@/lib/db";
import {createOnboardingLink} from "@/lib/stripeConnect";

export async function POST(req:NextRequest){
  const user=await getCurrentUser(req);if(!user||user.role!=="firma")return NextResponse.json({error:"Neautorizat"},{status:401});
  try{return NextResponse.json({url:await createOnboardingLink(db,user.id,new URL(req.url).origin)});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Onboarding indisponibil"},{status:409});}
}

export async function GET(req:NextRequest){
  const response=await POST(req);const body=await response.json();
  if(!response.ok)return NextResponse.json(body,{status:response.status});
  return NextResponse.redirect(body.url,303);
}
