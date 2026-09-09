import type { Database } from "better-sqlite3";

// Nitido Scan (Pachet C, modulul 1)
// ---------------------------------
// La postarea unei lucrări clientul face poze GHIDATE ale spațiului, câte una
// (sau mai multe) pe fiecare încăpere: bucătărie, baie, living etc. Astfel
// firma vede context clar înainte să preia/oferteze și poate estima mai bine.
//
// Pozele sunt stocate în tabela existentă `job_photos` cu proof_type
// 'CLIENT_CONTEXT'. Nitido Scan adaugă doar ETICHETA încăperii (`context_label`)
// pe fiecare poză, ca firma să știe ce reprezintă fiecare imagine.
//
// (Evaluarea automată cu AI a acestor poze vine într-o etapă ulterioară —
// aici pregătim doar contextul vizual etichetat.)

export interface ScanRoom {
  key: string;
  label: string;
}

// Încăperile ghidate propuse clientului la postare. Ordinea = ordinea afișată.
// `altul` acoperă orice spațiu care nu se încadrează (debara, balcon, birou...).
export const SCAN_ROOMS: readonly ScanRoom[] = [
  { key: "bucatarie", label: "Bucătărie" },
  { key: "baie", label: "Baie" },
  { key: "living", label: "Living" },
  { key: "dormitor", label: "Dormitor" },
  { key: "hol", label: "Hol / Intrare" },
  { key: "altul", label: "Alt spațiu" },
] as const;

const ROOM_BY_KEY = new Map(SCAN_ROOMS.map((r) => [r.key, r]));

/** Etichetă validă (una dintre încăperile ghidate) sau null dacă nu se recunoaște. */
export function normalizeScanRoom(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  return ROOM_BY_KEY.has(key) ? key : null;
}

/** Numele afișabil al unei încăperi pe baza cheii; „Alt spațiu" ca fallback. */
export function scanRoomLabel(key: string | null | undefined): string {
  if (!key) return "Alt spațiu";
  return ROOM_BY_KEY.get(key)?.label ?? "Alt spațiu";
}

export interface ScanPhoto {
  id: string;
  url: string;
  room: string | null;
  roomLabel: string;
  createdAt: string;
}

/**
 * Pozele de context (Nitido Scan) ale unei lucrări, cu etichetă de încăpere,
 * grupate/ordonate ca la afișare. Include doar pozele CLIENT_CONTEXT valide.
 */
export function listScanPhotosForJob(db: Database, jobId: string): ScanPhoto[] {
  const rows = db
    .prepare(
      `SELECT id, context_label, created_at
         FROM job_photos
        WHERE job_id = ? AND proof_type = 'CLIENT_CONTEXT' AND status = 'VALID'
        ORDER BY created_at ASC`
    )
    .all(jobId) as { id: string; context_label: string | null; created_at: string }[];
  return rows.map((r) => ({
    id: r.id,
    url: `/api/uploads/${r.id}`,
    room: r.context_label,
    roomLabel: scanRoomLabel(r.context_label),
    createdAt: r.created_at,
  }));
}
