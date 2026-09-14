import type { Database } from "better-sqlite3";

/**
 * Nitido Office (Etapa 4, B2B) — cont de business + raport de execuție.
 * Model ales: plată per lucrare (ca la client normal), dar contul are date de
 * firmă (contract/facturare) și un raport de execuție consolidat.
 * Funcții pure (primesc db), testabile fără Next.js.
 */

export interface BusinessProfile {
  isBusiness: boolean;
  companyName: string | null;
  companyCui: string | null;
  companyAddress: string | null;
}

export type BusinessResult = { ok: true } | { ok: false; error: string; status: number };

export function getBusinessProfile(db: Database, userId: string): BusinessProfile {
  const row = db
    .prepare("SELECT is_business, company_name, company_cui, company_address FROM users WHERE id = ?")
    .get(userId) as
    | { is_business: number; company_name: string | null; company_cui: string | null; company_address: string | null }
    | undefined;
  return {
    isBusiness: Boolean(row?.is_business),
    companyName: row?.company_name ?? null,
    companyCui: row?.company_cui ?? null,
    companyAddress: row?.company_address ?? null,
  };
}

/** Activează contul business și salvează datele firmei. */
export function setBusinessProfile(
  db: Database,
  userId: string,
  input: { companyName?: unknown; companyCui?: unknown; companyAddress?: unknown }
): BusinessResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Date de firmă invalide", status: 400 };
  for (const [key, limit] of [["companyName", 200], ["companyCui", 50], ["companyAddress", 500]] as const) {
    const value = input[key];
    if (value != null && (typeof value !== "string" || value.length > limit)) return { ok: false, error: "Date de firmă invalide sau prea lungi", status: 400 };
  }
  const name = typeof input.companyName === "string" ? input.companyName.trim() : "";
  const cui = typeof input.companyCui === "string" ? input.companyCui.trim() : "";
  const address = typeof input.companyAddress === "string" ? input.companyAddress.trim() : "";
  if (!name) return { ok: false, error: "Numele firmei este obligatoriu", status: 400 };
  if (!cui) return { ok: false, error: "CUI-ul firmei este obligatoriu", status: 400 };
  const res = db
    .prepare(
      "UPDATE users SET is_business = 1, company_name = ?, company_cui = ?, company_address = ? WHERE id = ? AND role = 'client'"
    )
    .run(name, cui, address || null, userId);
  if (res.changes === 0) return { ok: false, error: "Cont client inexistent", status: 404 };
  return { ok: true };
}

/** Dezactivează contul business (rămâne client normal). */
export function clearBusinessProfile(db: Database, userId: string): BusinessResult {
  db.prepare("UPDATE users SET is_business = 0 WHERE id = ?").run(userId);
  return { ok: true };
}

export interface ExecutionReportRow {
  propertyId?: string | null;
  propertyName?: string | null;
  costCenter?: string | null;
  arrivalDelayMinutes?: number | null;
  caseCount?: number;
  openCases?: number;
  receiptConfirmedAt?: string | null;
  jobId: string;
  completedAt: string | null;
  city: string;
  street: string;
  sqm: number;
  spaceType: string;
  priceGross: number;
  firmName: string | null;
}

export interface ExecutionReport {
  scope?: 'all' | 'business';
  propertyId?: string | null;
  currency?: 'RON';
  month: string | null;
  rows: ExecutionReportRow[];
  totalJobs: number;
  totalAmount: number;
}

/**
 * Raport de execuție: lucrările finalizate ale clientului business, cu totaluri.
 * `month` opțional în format YYYY-MM filtrează după luna finalizării.
 */
export function executionReport(db: Database, userId: string, month?: string | null, filter: {scope?: 'all'|'business';propertyId?:string|null;organizationId?:string|null} = {}): ExecutionReport {
  const useMonth = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
  const scope=filter.scope??'all',propertyId=filter.propertyId??null,organizationId=filter.organizationId??null;
  const rows=db.prepare(`SELECT j.id AS jobId,j.completed_at AS completedAt,j.city,j.street,
    j.sqm,j.space_type AS spaceType,j.price_gross AS priceGross,u.name AS firmName,
    p.id AS propertyId,p.name AS propertyName,p.cost_center AS costCenter,
    CASE WHEN julianday(j.arrived_confirmed_at) IS NOT NULL AND julianday(j.scheduled_at) IS NOT NULL
      THEN MAX(0,CAST(ROUND((julianday(j.arrived_confirmed_at)-julianday(j.scheduled_at))*1440) AS INTEGER)) ELSE NULL END AS arrivalDelayMinutes,
    (SELECT COUNT(*) FROM visit_cases c WHERE c.job_id=j.id) AS caseCount,
    (SELECT COUNT(*) FROM visit_cases c WHERE c.job_id=j.id AND c.status NOT IN ('resolved','closed')) AS openCases,
    (SELECT r.confirmed_at FROM visit_receipts r WHERE r.job_id=j.id AND r.client_id=j.client_id) AS receiptConfirmedAt
    FROM jobs j LEFT JOIN firms f ON f.id=j.accepted_firm_id LEFT JOIN users u ON u.id=f.user_id
    LEFT JOIN workspace_property_jobs pj ON pj.job_id=j.id
    LEFT JOIN workspace_properties p ON p.id=pj.property_id AND p.owner_id=j.client_id
    WHERE j.client_id=? AND j.status='completed'
      AND (? IS NULL OR strftime('%Y-%m',j.completed_at)=?)
      AND (?='all' OR p.kind='business') AND (? IS NULL OR p.id=?)
      AND (? IS NULL OR EXISTS(SELECT 1 FROM workspace_organization_properties op JOIN workspace_organizations o ON o.id=op.organization_id WHERE op.property_id=p.id AND o.id=? AND o.owner_id=j.client_id))
    ORDER BY j.completed_at DESC,j.id`).all(userId,useMonth,useMonth,scope,propertyId,propertyId,organizationId,organizationId) as ExecutionReportRow[];
  const totalBani=rows.reduce((sum,r)=>sum+Math.round(r.priceGross*100),0);
  return {month:useMonth,scope,propertyId,currency:'RON',rows,totalJobs:rows.length,totalAmount:totalBani/100};
}
