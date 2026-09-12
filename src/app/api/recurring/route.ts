import {consumeRateLimit,hasTrustedMutationOrigin} from "@/lib/security";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getClientCardInfo } from "@/lib/clientPayments";
import { validateRecurringPlan, type RecurringPlanInput, createRecurringPlan, listPlansForClient, listRecurringOccurrences, generateDueRecurringJobs } from "@/lib/recurring";
import type { SpaceType } from "@/lib/pricing";

// GET — citire fără generare de lucrări sau operațiuni financiare.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });
  }
  return NextResponse.json({ plans: listPlansForClient(db, user.id), occurrences:listRecurringOccurrences(db,user.id) },{headers:{"Cache-Control":"private, no-store"}});
}

// POST — creează un abonament recurent.
export async function POST(req: NextRequest) {
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

  if(b.action==="generate"){
    const result=await generateDueRecurringJobs(db,new Date(),user.id);
    return NextResponse.json({ok:true,created:result.created.length},{headers:{"Cache-Control":"private, no-store"}});
  }
  if(b.action!==undefined)return NextResponse.json({error:"Acțiune invalidă"},{status:400});
  const input:RecurringPlanInput = {
    clientId: user.id,
    preferredFirmId: typeof b?.preferredFirmId === "string" ? b.preferredFirmId : null,
    frequency: b?.frequency,
    street: b?.street,
    postalCode: b?.postalCode ?? null,
    city: b?.city,
    floor: b?.floor ?? null,
    sqm: b?.sqm,
    spaceType: b?.spaceType as SpaceType,
    hour: b?.hour,
    details: b?.details ?? null,
    startDate: b?.startDate,
  };
  const invalid=validateRecurringPlan(input);
  if(invalid)return NextResponse.json({error:invalid.error},{status:invalid.status});
  // Card necesar: lucrările generate autorizează plata automat pe firma preferată.
  const card = getClientCardInfo(db, user.id);
  if (card.stripeConfigured && !card.hasCard) {
    return NextResponse.json(
      { error: "Adaugă un card înainte de a crea un abonament.", needsCard: true },
      { status: 402 }
    );
  }

  const result=createRecurringPlan(db,input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ planId: result.planId }, { status: 201 });
}
