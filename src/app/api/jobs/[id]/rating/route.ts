import { NextRequest, NextResponse } from "next/server";
import { db, newId } from "@/lib/db";
import { JobRow } from "@/lib/types";

// Sistem de rating firmă — spec secțiunea 5c.
// Obligatoriu (stele) ca lucrarea să fie marcată complet "închisă"; comentariu opțional;
// 3 criterii rapide opționale (bife): punctualitate / calitate / comunicare.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { stars, punctuality, quality, communication, comment } = body as {
    stars: number;
    punctuality?: boolean;
    quality?: boolean;
    communication?: boolean;
    comment?: string;
  };

  if (!stars || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "Rating invalid (1-5 stele)" }, { status: 400 });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
  if (!job) return NextResponse.json({ error: "Lucrare inexistentă" }, { status: 404 });
  if (job.status !== "completed" || !job.accepted_firm_id) {
    return NextResponse.json(
      { error: "Doar lucrările finalizate pot primi rating" },
      { status: 409 }
    );
  }

  // Doar clientul care a avut lucrarea finalizată poate lăsa rating — previne rating-uri false.
  const existing = db.prepare("SELECT id FROM ratings WHERE job_id = ?").get(id);
  if (existing) {
    return NextResponse.json({ error: "Lucrarea a primit deja un rating" }, { status: 409 });
  }

  const ratingId = newId("rating");
  db.prepare(
    `INSERT INTO ratings (id, job_id, firm_id, client_id, stars, punctuality, quality, communication, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    ratingId,
    id,
    job.accepted_firm_id,
    job.client_id,
    stars,
    punctuality ? 1 : 0,
    quality ? 1 : 0,
    communication ? 1 : 0,
    comment ?? null
  );

  db.prepare(
    `UPDATE firms SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?`
  ).run(stars, job.accepted_firm_id);

  return NextResponse.json({ ok: true });
}
