import { NextRequest,NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPublicTrustSnapshot } from "@/lib/reviews";
export async function GET(req:NextRequest){const firmId=new URL(req.url).searchParams.get("firmId")??undefined;return NextResponse.json(getPublicTrustSnapshot(db,firmId));}
