import type { Database } from "better-sqlite3";

/**
 * Nitido Office (Etapa 3, B2B) — cont de business + raport de execuție.
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
  input: { companyName?: string; companyCui?: string; companyAddress?: string }
): BusinessResult {
  const name = (input.companyName ?? "").trim();
  const cui = (input.companyCui ?? "").trim();
  const address = (input.companyAddress ?? "").trim();
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
  month: string | null;
  rows: ExecutionReportRow[];
  totalJobs: number;
  totalAmount: number;
}

/**
 * Raport de execuție: lucrările finalizate ale clientului business, cu totaluri.
 * `month` opțional în format YYYY-MM filtrează după luna finalizării.
 */
export function executionReport(db: Database, userId: string, month?: string | null): ExecutionReport {
  const useMonth = typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : null;
  const rows = (
    useMonth
      ? db
          .prepare(
            `SELECT j.id AS jobId, j.completed_at AS completedAt, j.city AS city, j.street AS street,
                    j.sqm AS sqm, j.space_type AS spaceType, j.price_gross AS priceGross, u.name AS firmName
             FROM jobs j
             LEFT JOIN firms f ON f.id = j.accepted_firm_id
             LEFT JOIN users u ON u.id = f.user_id
             WHERE j.client_id = ? AND j.status = 'completed' AND strftime('%Y-%m', j.completed_at) = ?
             ORDER BY j.completed_at DESC`
          )
          .all(userId, useMonth)
      : db
          .prepare(
            `SELECT j.id AS jobId, j.completed_at AS completedAt, j.city AS city, j.street AS street,
                    j.sqm AS sqm, j.space_type AS spaceType, j.price_gross AS priceGross, u.name AS firmName
             FROM jobs j
             LEFT JOIN firms f ON f.id = j.accepted_firm_id
             LEFT JOIN users u ON u.id = f.user_id
             WHERE j.client_id = ? AND j.status = 'completed'
             ORDER BY j.completed_at DESC`
          )
          .all(userId)
  ) as ExecutionReportRow[];

  const totalAmount = rows.reduce((sum, r) => sum + (r.priceGross || 0), 0);
  return { month: useMonth, rows, totalJobs: rows.length, totalAmount };
}
