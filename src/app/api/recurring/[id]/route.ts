import {consumeRateLimit,hasTrustedMutationOrigin} from "@/lib/security";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { setPlanStatus, schedulePlanPause } from "@/lib/recurring";

// POST — schimbă starea abonamentului (pauză / reactivare / anulare).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }
  if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:"Origine invalidă"},{status:403});
  if(!consumeRateLimit(`recurring:${user.id}`,20,60000))return NextResponse.json({error:"Prea multe cereri. Reîncearcă într-un minut."},{status:429});
  const raw=await req.text();
  if(Buffer.byteLength(raw)>10000)return NextResponse.json({error:"Cerere prea mare"},{status:413});
  let b;
  try{b=JSON.parse(raw)}catch{return NextResponse.json({error:"Cerere JSON invalidă"},{status:400})}
  if(!b||typeof b!=="object"||Array.isArray(b))return NextResponse.json({error:"Cerere invalidă"},{status:400});
  const { id } = await params;
  if(b.action==="pause_interval"){
    const result=schedulePlanPause(db,id,user.id,b.startDate,b.endDate);
    return NextResponse.json(result.ok?{ok:true}:{error:result.error},{status:result.ok?200:result.status});
  }
  if(b.action!==undefined)return NextResponse.json({error:"Action invalidă"},{status:400});
  const status = b?.status;
  if (status !== "active" && status !== "paused" && status !== "cancelled") {
    return NextResponse.json({ error: "Stare invalidă" }, { status: 400 });
  }
  const result = setPlanStatus(db, id, user.id, status);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
