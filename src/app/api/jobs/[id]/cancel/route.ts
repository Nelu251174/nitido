import { after, NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rescueAcceptedJob } from "@/lib/jobRescue";
import { processPushOutbox, queueNewJobFirmPushes } from "@/lib/push";

// POST — firma renunță la o lucrare acceptată. Job Rescue: eliberează plata și
// repune automat lucrarea în piață (o nouă lucrare 'waiting').
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "firma") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca firmă" }, { status: 401 });
  }
  const firm = getFirmByUserId(user.id);
  if (!firm) return NextResponse.json({ error: "Profilul firmei nu a fost găsit" }, { status: 403 });
  const { id } = await params;
  const result = await rescueAcceptedJob(db, id, firm.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // Notifică firmele din zonă despre lucrarea repusă.
  try {
    const reposted = db.prepare("SELECT id, city, space_type, sqm FROM jobs WHERE id = ?").get(result.newJobId) as { id: string; city: string; space_type: string; sqm: number } | undefined;
    if (reposted) {
      const ids = queueNewJobFirmPushes(db, { id: reposted.id, city: reposted.city, spaceType: reposted.space_type, sqm: reposted.sqm });
      if (ids.length) after(() => processPushOutbox(db, ids));
    }
  } catch {
    console.error("[push-outbox] enqueue_failed JOB_RESCUE_REPOST_PUSH");
  }
  return NextResponse.json({ ok: true, newJobId: result.newJobId });
}
