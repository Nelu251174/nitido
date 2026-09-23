import { db } from "@/lib/db";

export type ProRole = "owner_client" | "partner" | "nitido_admin";

export function getMemberships(userId: string): {
  role: ProRole;
  organization_id: string | null;
  partner_id: string | null;
}[] {
  return db
    .prepare(
      "SELECT role, organization_id, partner_id FROM pro_memberships WHERE user_id = ?"
    )
    .all(userId) as {
    role: ProRole;
    organization_id: string | null;
    partner_id: string | null;
  }[];
}

export function isAdmin(userId: string): boolean {
  return getMemberships(userId).some((m) => m.role === "nitido_admin");
}

export function clientOrgIds(userId: string): string[] {
  return getMemberships(userId)
    .filter((m) => m.role === "owner_client" && m.organization_id)
    .map((m) => m.organization_id as string);
}

export function activePartnerId(userId: string): string | null {
  const row = db
    .prepare(
      `SELECT p.id as id
       FROM pro_memberships m
       JOIN pro_partners p ON p.id = m.partner_id
       WHERE m.user_id = ? AND m.role = 'partner' AND p.status = 'active'`
    )
    .get(userId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function canSeeSensitiveJob(
  userId: string,
  job: { organization_id: string; assigned_partner_id: string | null; status: string }
): boolean {
  if (isAdmin(userId)) return true;
  if (clientOrgIds(userId).includes(job.organization_id)) return true;
  const partnerId = activePartnerId(userId);
  return Boolean(
    partnerId &&
      job.assigned_partner_id === partnerId &&
      ["acceptata", "in_desfasurare", "raportata", "necesita_clarificare", "aprobata", "inchisa"].includes(
        job.status
      )
  );
}
