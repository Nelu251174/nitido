import type { Database } from "better-sqlite3";
import {
  createHash,
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { CHECKLISTS, SERVICES } from "./shared";
import { hostLocalInstant } from "../hostScheduleShared";
import {bucharestDateKey,bookingDateKey} from "../scheduling";
export type Principal = { id: string; admin?: boolean };
export type Role =
  "owner" | "manager" | "approver" | "viewer" | "contact" | "operator";
export type Member = {
  id: string;
  organization_id: string;
  user_id: string;
  role: Role;
  scope_json: string;
  active: number;
};
export type Property = {
  id: string;
  organization_id: string;
  name: string;
  city: string;
  address: string;
  postal_code: string;
  floor: string;
  status: string;
  threshold: number | null;
  instructions: string;
};
export type Work = {
  id: string;
  organization_id: string;
  property_id: string;
  title: string;
  service: string;
  status: string;
  starts_at: string;
  ends_at: string;
  partner_id: string | null;
  threshold_snapshot: number;
  estimate: number;
  final_cost: number | null;
  financial_status: string;
  quote_version: number;
  revision: number;
  checklist_json: string;
  answers_json: string;
  created_by: string;
  review_note: string;
};
export type Org = {
  id: string;
  name: string;
  city: string;
  status: string;
  threshold: number;
  separate_approver: number;
  contract_ref: string;
};
export type Ticket = {
  id: string;
  organization_id: string;
  property_id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  work_order_id: string | null;
};
export class ProError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
export function fail(message: string, status = 422): never {
  throw new ProError(message, status);
}
export const text = (v: unknown, label: string, max = 250) =>
  typeof v === "string" && v.trim() && v.length <= max
    ? v.trim()
    : fail(`${label}: valoare obligatorie, maximum ${max} caractere.`);
export const int = (v: unknown, label: string, min = 0, max = 100000000) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max
    ? v
    : fail(`${label}: număr invalid.`);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const now = () => new Date().toISOString();
export const activeWork = (w: Work) =>
  [
    "accepted",
    "in_progress",
    "submitted_for_review",
    "rework_requested",
  ].includes(w.status);
export function ready(db: Database) {
  if (
    !db
      .prepare("SELECT 1 FROM sqlite_master WHERE name='pro_schema_migrations'")
      .get()
  )
    fail("Modulul Pro așteaptă configurarea tehnică.", 503);
}
export function memberships(db: Database, p: Principal, org?: string) {
  return db
    .prepare(
      `SELECT * FROM pro_members WHERE user_id=? AND active=1${org ? " AND organization_id=?" : ""}`,
    )
    .all(...(org ? [p.id, org] : [p.id])) as Member[];
}
export function allowed(
  db: Database,
  p: Principal,
  org: string,
  roles: Role[],
  property?: string | null,
) {
  // undefined checks role membership; null requires organization-wide scope.
  return memberships(db, p, org).some(
    (m) =>
      roles.includes(m.role) &&
      (property === undefined ||
        m.role === "owner" ||
        JSON.parse(m.scope_json).length === 0 ||
        (property !== null && JSON.parse(m.scope_json).includes(property))),
  );
}
export function requireRole(
  db: Database,
  p: Principal,
  org: string,
  roles: Role[],
  property?: string | null,
) {
  if (p.admin && roles.includes("operator")) return;
  if (!allowed(db, p, org, roles, property)) fail("Acces interzis.", 404);
}
export function organization(db: Database, p: Principal, id: string) {
  const o = db.prepare("SELECT * FROM pro_organizations WHERE id=?").get(id) as
    Org | undefined;
  if (!o) fail("Organizație inexistentă.", 404);
  requireRole(db, p, id, [
    "owner",
    "manager",
    "approver",
    "viewer",
    "contact",
    "operator",
  ]);
  return o;
}
export function property(
  db: Database,
  p: Principal,
  id: string,
  roles: Role[] = [
    "owner",
    "manager",
    "approver",
    "viewer",
    "contact",
    "operator",
  ],
) {
  const row = db.prepare("SELECT * FROM pro_properties WHERE id=?").get(id) as
    Property | undefined;
  if (!row) fail("Proprietate inexistentă.", 404);
  requireRole(db, p, row.organization_id, roles, id);
  return row;
}
export function partnerIds(db: Database, p: Principal) {
  return (
    db
      .prepare(
        "SELECT p.id FROM pro_partners p JOIN pro_partner_members m ON m.partner_id=p.id WHERE m.user_id=? AND m.active=1 AND p.status='active'",
      )
      .all(p.id) as { id: string }[]
  ).map((r) => r.id);
}
export function work(db: Database, p: Principal, id: string) {
  const w = db.prepare("SELECT * FROM pro_work_orders WHERE id=?").get(id) as
    Work | undefined;
  if (!w) fail("Lucrare inexistentă.", 404);
  if (
    p.admin ||
    allowed(
      db,
      p,
      w.organization_id,
      ["owner", "manager", "approver", "viewer", "contact", "operator"],
      w.property_id,
    )
  )
    return w;
  const ids = partnerIds(db, p);
  if (w.partner_id && ids.includes(w.partner_id) && activeWork(w)) return w;
  if (
    w.status === "offered" &&
    (
      db
        .prepare(
          "SELECT partner_id FROM pro_offers WHERE work_order_id=? AND status='offered' AND expires_at>?",
        )
        .all(w.id, now()) as { partner_id: string }[]
    ).some((o) => ids.includes(o.partner_id))
  )
    return w;
  fail("Lucrare inexistentă.", 404);
}
export function ticket(db: Database, p: Principal, id: string) {
  const t = db.prepare("SELECT * FROM pro_tickets WHERE id=?").get(id) as
    Ticket | undefined;
  if (!t) fail("Tichet inexistent.", 404);
  requireRole(
    db,
    p,
    t.organization_id,
    ["owner", "manager", "approver", "viewer", "contact", "operator"],
    t.property_id,
  );
  return t;
}
export type NotificationTarget = {
  organization_id: string;
  user_id: string;
  href: string;
  event_key: string;
};
/** Queued notifications must obey the recipient's current resource access. */
export function notificationAllowed(db: Database, p: Principal, n: NotificationTarget) {
  if (n.user_id !== p.id) return false;
  try {
    const target = /^\/pro\/(lucrari|tichete)\/([^/?#]+)$/.exec(n.href);
    if (target) {
      const resource = target[1] === "lucrari"
        ? work(db, p, target[2]) : ticket(db, p, target[2]);
      return resource.organization_id === n.organization_id;
    }
    if (n.href === "/pro/calendar") {
      const rule = db.prepare("SELECT property_id,organization_id FROM pro_recurring_rules WHERE id=?")
        .get(n.event_key.split(":")[0]) as { property_id: string; organization_id: string } | undefined;
      return !!rule && rule.organization_id === n.organization_id &&
        allowed(db, p, rule.organization_id, ["owner", "manager", "operator", "approver"], rule.property_id);
    }
    return false;
  } catch (error) {
    if (error instanceof ProError && error.status === 404) return false;
    throw error;
  }
}

export function partnerWork(db: Database, p: Principal) {
  return db.prepare(`
    SELECT w.* FROM pro_work_orders w
    WHERE w.status NOT IN ('completed','cancelled') AND (
      EXISTS (SELECT 1 FROM pro_partner_members m JOIN pro_partners p ON p.id=m.partner_id
        WHERE m.user_id=? AND m.active=1 AND p.status='active' AND p.id=w.partner_id
        AND w.status IN ('accepted','in_progress','submitted_for_review','rework_requested'))
      OR (w.status='offered' AND EXISTS (
        SELECT 1 FROM pro_offers o JOIN pro_partners p ON p.id=o.partner_id
        JOIN pro_partner_members m ON m.partner_id=p.id
        WHERE o.work_order_id=w.id AND o.status='offered' AND o.expires_at>?
        AND p.status='active' AND m.user_id=? AND m.active=1)))
    ORDER BY w.starts_at,w.id LIMIT 500
  `).all(p.id, now(), p.id) as Work[];
}
export function audit(
  db: Database,
  p: Principal,
  org: string | null,
  id: string,
  action: string,
  details: object = {},
) {
  db.prepare("INSERT INTO pro_audit_logs VALUES(?,?,?,?,?,?,?)").run(
    randomUUID(),
    org,
    p.id,
    id,
    action,
    JSON.stringify(details),
    now(),
  );
}
export function notify(
  db: Database,
  org: string,
  propertyId: string,
  event: string,
  title: string,
  href: string,
  extra: string[] = [],
) {
  const users = new Set(extra);
  for (const m of db
    .prepare(
      "SELECT * FROM pro_members WHERE organization_id=? AND active=1 AND role IN ('owner','manager','operator','approver')",
    )
    .all(org) as Member[]) {
    const scope = JSON.parse(m.scope_json) as string[];
    if (m.role === "owner" || !scope.length || scope.includes(propertyId))
      users.add(m.user_id);
  }
  for (const id of users)
    db.prepare(
      "INSERT OR IGNORE INTO pro_notifications(id,organization_id,user_id,event_key,title,href,next_attempt,created_at) VALUES(?,?,?,?,?,?,?,?)",
    ).run(randomUUID(), org, id, event, title, href, now(), now());
}
export function atomic(
  db: Database,
  p: Principal,
  key: string,
  body: unknown,
  fn: () => object,
) {
  text(key, "Identificator cerere", 120);
  if (key.length < 16) fail("Identificator cerere invalid.");
  return db
    .transaction(() => {
      const h = hash(JSON.stringify(body));
      const old = db
        .prepare("SELECT * FROM pro_idempotency WHERE actor=? AND key=?")
        .get(p.id, key) as
        { request_hash: string; result_json: string } | undefined;
      if (old) {
        if (old.request_hash !== h)
          fail("Identificator reutilizat pentru altă operațiune.", 409);
        return JSON.parse(old.result_json) as object;
      }
      const result = fn();
      db.prepare("INSERT INTO pro_idempotency VALUES(?,?,?,?)").run(
        p.id,
        key,
        h,
        JSON.stringify(
          "invite_path" in result
            ? { ...result, invite_path: undefined }
            : result,
        ),
      );
      return result;
    })
    .immediate();
}
export function limit(db: Database, key: string, max = 30, window = 60000) {
  const stamp = Date.now();
  return db
    .transaction(() => {
      db.prepare("DELETE FROM pro_rate_limits WHERE expires_at<=?").run(stamp);
      const row = db
        .prepare("SELECT hits FROM pro_rate_limits WHERE key=?")
        .get(key) as { hits: number } | undefined;
      if (row && row.hits >= max)
        fail("Prea multe cereri. Reîncearcă mai târziu.", 429);
      db.prepare(
        "INSERT INTO pro_rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1",
      ).run(key, stamp + window);
    })
    .immediate();
}
export function approveRequest(db: Database, p: Principal, w: Work) {
  if (w.estimate > w.threshold_snapshot) {
    db.prepare(
      "INSERT INTO pro_approvals(id,organization_id,work_order_id,quote_version,amount,requested_by,created_at) VALUES(?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      w.organization_id,
      w.id,
      w.quote_version,
      w.estimate,
      p.id,
      now(),
    );
    notify(
      db,
      w.organization_id,
      w.property_id,
      `${w.id}:quote:${w.quote_version}`,
      "Un deviz necesită aprobare",
      `/pro/lucrari/${w.id}`,
    );
  }
}
export function proPhotoRulesReady(db:Database){return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='pro_work_photo_rules'").get();}
export function workPhotoRules(db:Database,id:string):{arrivalMin:number;completionMin:number}{return (proPhotoRulesReady(db)?db.prepare('SELECT arrival_min AS arrivalMin,completion_min AS completionMin FROM pro_work_photo_rules WHERE work_order_id=?').get(id):undefined) as {arrivalMin:number;completionMin:number}|undefined??{arrivalMin:0,completionMin:1};}
function proPhotoCount(db:Database,id:string,categories:string[]){return (db.prepare(`SELECT COUNT(DISTINCT hash) n FROM pro_media WHERE work_order_id=? AND category IN (${categories.map(()=>'?').join(',')}) AND created_at>COALESCE((SELECT MAX(created_at) FROM pro_audit_logs WHERE entity_id=? AND action='work.rework'),'')`).get(id,...categories,id) as {n:number}).n;}
export function checklistConfigurationReady(db: Database) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='pro_property_checklists'").get();
}
export function propertyChecklist(db: Database, propertyId: string, service: string) {
  if (!Object.hasOwn(SERVICES, service)) fail("Serviciu nepermis.");
  const row = checklistConfigurationReady(db) ? db.prepare(
    "SELECT revision,items_json,reason,actor,created_at FROM pro_property_checklists WHERE property_id=? AND service=? ORDER BY revision DESC LIMIT 1",
  ).get(propertyId, service) as { revision: number; items_json: string; reason: string; actor: string; created_at: string } | undefined : undefined;
  const photoRules=(row&&proPhotoRulesReady(db)?db.prepare('SELECT arrival_min AS arrivalMin,completion_min AS completionMin FROM pro_property_photo_rules WHERE property_id=? AND service=? AND revision=?').get(propertyId,service,row.revision):undefined) as {arrivalMin:number;completionMin:number}|undefined;
  return { photoRulesAvailable:proPhotoRulesReady(db),photoRules:photoRules??{arrivalMin:0,completionMin:1},service, revision: row?.revision ?? 0, items: row ? JSON.parse(row.items_json) as string[] : [...CHECKLISTS[service]], reason: row?.reason ?? "Listă standard pentru acest serviciu", actor: row?.actor ?? null, created_at: row?.created_at ?? null };
}
export function propertyChecklistConfiguration(db: Database, p: Principal, id: string) {
  property(db, p, id, ["owner", "manager", "operator"]);
  return { available: checklistConfigurationReady(db), templates: Object.keys(SERVICES).map(service => propertyChecklist(db, id, service)) };
}
export function propertyChecklistHistory(db: Database, p: Principal, id: string, service: string, before: number) {
  property(db, p, id, ["owner", "manager", "operator"]);
  if (!Object.hasOwn(SERVICES, service)) fail("Serviciu nepermis.");
  int(before, "Versiune istoric", 1, Number.MAX_SAFE_INTEGER);
  if (!checklistConfigurationReady(db)) return { rows: [], next: null };
  const rows = db.prepare("SELECT revision,items_json,reason,actor,created_at FROM pro_property_checklists WHERE property_id=? AND service=? AND revision<? ORDER BY revision DESC LIMIT 21").all(id, service, before) as { revision: number; items_json: string; reason: string; actor: string; created_at: string }[];
  return { rows: rows.slice(0, 20).map(({ items_json, ...r }) => ({ ...r, items: JSON.parse(items_json) as string[], photoRules: (proPhotoRulesReady(db) ? db.prepare("SELECT arrival_min AS arrivalMin,completion_min AS completionMin FROM pro_property_photo_rules WHERE property_id=? AND service=? AND revision=?").get(id, service, r.revision) : undefined) ?? {arrivalMin:0,completionMin:1} })), next: rows.length > 20 ? rows[19].revision : null };
}
export function savePropertyChecklist(db: Database, p: Principal, id: string, b: Record<string, unknown>) {
  const prop = property(db, p, id, ["owner", "manager", "operator"]);
  if (!db.inTransaction) throw new Error("Checklist publication requires an atomic transaction");
  if (!checklistConfigurationReady(db)) fail("Configurarea checklisturilor așteaptă migrarea tehnică.", 503);
  if (prop.status !== "active") fail("Proprietatea nu este activă.", 409);
  const service = text(b.service, "Serviciu");
  const current = propertyChecklist(db, id, service);
  if (int(b.revision, "Versiune") !== current.revision) fail("Lista a fost modificată. Reîncarcă proprietatea înainte de publicare.", 409);
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 40) fail("Lista trebuie să conțină între 1 și 40 de puncte.");
  const items = b.items.map(item => text(item, "Punct de verificare", 300));
  if (new Set(items.map(item => item.toLocaleLowerCase("ro-RO"))).size !== items.length) fail("Punctele de verificare trebuie să fie distincte.");
  const photos=b.photoRules===undefined?current.photoRules:b.photoRules as {arrivalMin:number;completionMin:number};
  if(!photos||!Number.isInteger(photos.arrivalMin)||photos.arrivalMin<0||photos.arrivalMin>20||!Number.isInteger(photos.completionMin)||photos.completionMin<1||photos.completionMin>20||photos.arrivalMin+photos.completionMin>20)fail('Reguli foto invalide: 0–19 la sosire, 1–20 la finalizare, maximum 20 în total.');
  if(b.photoRules!==undefined&&!proPhotoRulesReady(db))fail('Regulile foto așteaptă migrarea tehnică.',503);
  const reason = text(b.reason, "Motivul modificării", 2000), revision = current.revision + 1;
  db.prepare("INSERT INTO pro_property_checklists(property_id,service,revision,items_json,reason,actor,created_at) VALUES(?,?,?,?,?,?,?)").run(id, service, revision, JSON.stringify(items), reason, p.id, now());
  if(proPhotoRulesReady(db))db.prepare('INSERT INTO pro_property_photo_rules VALUES(?,?,?,?,?)').run(id,service,revision,photos.arrivalMin,photos.completionMin);
  audit(db, p, prop.organization_id, id, "property.checklist_published", { service, revision, previous_revision: current.revision, reason, photoRules: photos });
  return { property_id: id, service, revision };
}
export function createWork(
  db: Database,
  p: Principal,
  b: Record<string, unknown>,
) {
  const prop = property(db, p, text(b.property_id, "Proprietate"), [
    "owner",
    "manager",
    "operator",
  ]);
  const org = organization(db, p, prop.organization_id);
  if (org.status !== "active" || prop.status !== "active")
    fail("Portofoliul sau proprietatea nu este activă.", 409);
  const service = text(b.service, "Serviciu");
  if (!Object.hasOwn(SERVICES, service)) fail("Serviciu nepermis.");
  const start = new Date(text(b.starts_at, "Început")),
    end = new Date(text(b.ends_at, "Sfârșit"));
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    +end <= +start ||
    +end - +start > 12 * 3600000 ||
    +start < Date.now() - 60000
  )
    fail("Interval invalid sau în trecut.");
  if (
    db
      .prepare(
        "SELECT 1 FROM pro_work_orders WHERE property_id=? AND status NOT IN ('completed','cancelled') AND starts_at<? AND ends_at>?",
      )
      .get(prop.id, end.toISOString(), start.toISOString())
  )
    fail("Există deja o lucrare în acest interval.", 409);
  const checklist = propertyChecklist(db, prop.id, service);
  const id = randomUUID(),
    amount = int(b.estimate, "Cost estimat"),
    threshold = prop.threshold ?? org.threshold;
  db.prepare(
    `INSERT INTO pro_work_orders(id,organization_id,property_id,title,service,status,starts_at,ends_at,threshold_snapshot,estimate,financial_status,checklist_json,created_by,created_at) VALUES(?,?,?,?,?,'scheduled',?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    org.id,
    prop.id,
    text(b.title, "Titlu"),
    service,
    start.toISOString(),
    end.toISOString(),
    threshold,
    amount,
    amount > threshold ? "pending" : "not_required",
    JSON.stringify(checklist.items),
    p.id,
    now(),
  );
  const w = db
    .prepare("SELECT * FROM pro_work_orders WHERE id=?")
    .get(id) as Work;
  approveRequest(db, p, w);
  if(proPhotoRulesReady(db))db.prepare('INSERT INTO pro_work_photo_rules VALUES(?,?,?)').run(id,checklist.photoRules.arrivalMin,checklist.photoRules.completionMin);
  audit(db, p, org.id, id, "work.created", { checklist_revision: checklist.revision, checklist_service: service });
  return { id };
}
function finance(w: Work) {
  if (!["approved", "not_required"].includes(w.financial_status))
    fail("Execuția așteaptă autorizarea costului.", 409);
}
export function workCommand(
  db: Database,
  p: Principal,
  id: string,
  action: string,
  b: Record<string, unknown>,
) {
  const w = work(db, p, id);
  if (b.revision !== w.revision)
    fail("Lucrarea s-a modificat. Reîncarcă pagina.", 409);
  const manage = () =>
      requireRole(
        db,
        p,
        w.organization_id,
        ["owner", "manager", "operator"],
        w.property_id,
      ),
    operator = () =>
      requireRole(db, p, w.organization_id, ["operator"], w.property_id);
  const partner = () => {
    if (
      !w.partner_id ||
      !partnerIds(db, p).includes(w.partner_id) ||
      !activeWork(w)
    )
      fail("Acțiune rezervată partenerului alocat.", 403);
  };
  const from = (states: string[]) => {
    if (!states.includes(w.status))
      fail("Acțiune indisponibilă în această stare.", 409);
  };
  const move = (state: string) =>
    db
      .prepare(
        "UPDATE pro_work_orders SET status=?,revision=revision+1 WHERE id=?",
      )
      .run(state, id);
  if (action === "quote") {
    manage();
    from(["scheduled", "accepted", "in_progress", "rework_requested"]);
    const amount = int(b.amount, "Deviz");
    const reason = text(b.note, "Motiv", 2000);
    db.prepare(
      "UPDATE pro_approvals SET decision='superseded' WHERE work_order_id=? AND decision='pending'",
    ).run(id);
    const version = w.quote_version + 1;
    db.prepare(
      "UPDATE pro_work_orders SET estimate=?,financial_status=?,quote_version=?,revision=revision+1,review_note=? WHERE id=?",
    ).run(
      amount,
      amount > w.threshold_snapshot ? "pending" : "not_required",
      version,
      reason,
      id,
    );
    approveRequest(db, p, { ...w, estimate: amount, quote_version: version });
  } else if (action === "offer") {
    operator();
    from(["scheduled"]);
    finance(w);
    const partnerId = text(b.partner_id, "Partener");
    const partnerRow = db
      .prepare("SELECT * FROM pro_partners WHERE id=? AND status='active'")
      .get(partnerId) as
      { cities_json: string; services_json: string } | undefined;
    const prop = db
      .prepare("SELECT city FROM pro_properties WHERE id=?")
      .get(w.property_id) as { city: string };
    if (
      !partnerRow ||
      !JSON.parse(partnerRow.cities_json).includes(prop.city) ||
      !JSON.parse(partnerRow.services_json).includes(w.service)
    )
      fail("Partener neeligibil pentru zonă/serviciu.");
    const expiry = new Date(
      Math.min(Date.now() + 2 * 3600000, +new Date(w.starts_at)),
    );
    if (+expiry <= Date.now())
      fail("Reprogramează lucrarea înainte de ofertare.");
    db.prepare("INSERT INTO pro_offers VALUES(?,?,?,?,'offered',?,?)").run(
      randomUUID(),
      w.organization_id,
      id,
      partnerId,
      expiry.toISOString(),
      now(),
    );
    move("offered");
    const users = (
      db
        .prepare(
          "SELECT user_id FROM pro_partner_members WHERE partner_id=? AND active=1",
        )
        .all(partnerId) as { user_id: string }[]
    ).map((x) => x.user_id);
    notify(
      db,
      w.organization_id,
      w.property_id,
      `${id}:offered:${w.revision}`,
      "O lucrare a fost oferită",
      `/pro/lucrari/${id}`,
      users,
    );
  } else if (action === "accept" || action === "decline") {
    from(["offered"]);
    const ids = partnerIds(db, p);
    const offer = db
      .prepare(
        "SELECT * FROM pro_offers WHERE work_order_id=? AND status='offered' AND expires_at>?",
      )
      .get(id, now()) as { id: string; partner_id: string } | undefined;
    if (!offer || !ids.includes(offer.partner_id))
      fail("Oferta nu este disponibilă.", 409);
    if (action === "accept") finance(w);
    db.prepare("UPDATE pro_offers SET status=? WHERE id=?").run(
      action === "accept" ? "accepted" : "declined",
      offer.id,
    );
    db.prepare("UPDATE pro_work_orders SET partner_id=? WHERE id=?").run(
      action === "accept" ? offer.partner_id : null,
      id,
    );
    move(action === "accept" ? "accepted" : "scheduled");
  } else if (action === "start") {
    partner();
    from(["accepted", "rework_requested"]);
    finance(w);
    if (
      Date.now() < +new Date(w.starts_at) - 2 * 3600000 ||
      Date.now() > +new Date(w.ends_at)
    )
      fail("Execuția este în afara ferestrei programate.", 409);
    if(proPhotoCount(db,id,['before'])<workPhotoRules(db,id).arrivalMin)fail(`Încarcă minimum ${workPhotoRules(db,id).arrivalMin} fotografii de sosire pentru această execuție.`,409);
    move("in_progress");
    db.prepare(
      "UPDATE pro_tickets SET status='in_progress' WHERE work_order_id=?",
    ).run(id);
  } else if (action === "checklist") {
    partner();
    from(["in_progress"]);
    const list = JSON.parse(w.checklist_json) as string[];
    const answers = b.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers))
      fail("Checklist invalid.");
    const normalized = Object.fromEntries(
      list.map((_, i) => [
        String(i),
        (answers as Record<string, unknown>)[String(i)] === true,
      ]),
    );
    db.prepare(
      "UPDATE pro_work_orders SET answers_json=?,revision=revision+1 WHERE id=?",
    ).run(JSON.stringify(normalized), id);
  } else if (action === "submit") {
    partner();
    from(["in_progress"]);
    finance(w);
    const list = JSON.parse(w.checklist_json) as string[],
      answers = JSON.parse(w.answers_json) as Record<string, boolean>;
    if (!list.every((_, i) => answers[String(i)]))
      fail("Finalizează toate punctele obligatorii.", 409);
    if(proPhotoCount(db,id,['after','resolution'])<workPhotoRules(db,id).completionMin)
      fail(`Încarcă dovada foto de finalizare: minimum ${workPhotoRules(db,id).completionMin} fotografii distincte pentru această execuție.`,409);
    const amount = int(b.final_cost, "Cost final");
    if (amount > w.estimate)
      fail("Costul suplimentar trebuie aprobat înainte de execuție.", 409);
    db.prepare("UPDATE pro_work_orders SET final_cost=? WHERE id=?").run(
      amount,
      id,
    );
    move("submitted_for_review");
  } else if (action === "complete") {
    operator();
    from(["submitted_for_review"]);
    finance(w);
    if (w.final_cost === null || w.final_cost > w.estimate)
      fail("Cost final invalid.", 409);
    move("completed");
    db.prepare(
      "INSERT INTO pro_cost_entries(id,organization_id,property_id,work_order_id,category,amount,created_at) VALUES(?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      w.organization_id,
      w.property_id,
      id,
      w.service === "light_maintenance"
        ? "maintenance_labor"
        : w.service === "property_check"
          ? "inspection"
          : w.service === "consumables_refill"
            ? "consumables"
            : "cleaning",
      w.final_cost,
      now(),
    );
    db.prepare(
      "UPDATE pro_tickets SET status='resolved' WHERE work_order_id=?",
    ).run(id);
  } else if (action === "rework") {
    operator();
    from(["submitted_for_review"]);
    const note = text(b.note, "Motiv remediere", 2000);
    const start = new Date(text(b.starts_at, "Început")),
      end = new Date(text(b.ends_at, "Sfârșit"));
    if (
      !Number.isFinite(+start) ||
      !Number.isFinite(+end) ||
      +end <= +start ||
      +end < Date.now() ||
      +end - +start > 12 * 3600000
    )
      fail("Interval remediere invalid.");
    if (db.prepare(
      "SELECT 1 FROM pro_work_orders WHERE property_id=? AND id<>? AND status NOT IN ('completed','cancelled') AND starts_at<? AND ends_at>?",
    ).get(w.property_id, id, end.toISOString(), start.toISOString()))
      fail("Există deja o lucrare în acest interval.", 409);
    db.prepare(
      "UPDATE pro_work_orders SET review_note=?,starts_at=?,ends_at=?,answers_json=?,final_cost=NULL WHERE id=?",
    ).run(note, start.toISOString(), end.toISOString(), "{}", id);
    move("rework_requested");
  } else if (action === "cancel") {
    manage();
    if (["completed", "cancelled"].includes(w.status))
      fail("Stare terminală.", 409);
    text(b.note, "Motiv anulare", 2000);
    db.prepare(
      "UPDATE pro_offers SET status='withdrawn' WHERE work_order_id=? AND status='offered'",
    ).run(id);
    db.prepare(
      "UPDATE pro_approvals SET decision='superseded' WHERE work_order_id=? AND decision='pending'",
    ).run(id);
    move("cancelled");
  } else fail("Acțiune necunoscută.", 404);
  audit(db, p, w.organization_id, id, `work.${action}`, {
    from: w.status,
    ...(action === "rework" ? {
      previous_starts_at: w.starts_at, previous_ends_at: w.ends_at,
      starts_at: new Date(String(b.starts_at)).toISOString(),
      ends_at: new Date(String(b.ends_at)).toISOString(),
      previous_final_cost: w.final_cost,
      previous_answers: JSON.parse(w.answers_json),
    } : {}),
    note: typeof b.note === "string" ? b.note.slice(0, 2000) : "",
  });
  notify(
    db,
    w.organization_id,
    w.property_id,
    `${id}:${action}:${w.revision}`,
    action === "submit"
      ? "Lucrare trimisă spre verificare"
      : "Lucrare actualizată",
    `/pro/lucrari/${id}`,
  );
  return { id };
}
export function decide(
  db: Database,
  p: Principal,
  id: string,
  b: Record<string, unknown>,
) {
  const a = db.prepare("SELECT * FROM pro_approvals WHERE id=?").get(id) as
    | {
        id: string;
        organization_id: string;
        work_order_id: string;
        quote_version: number;
        amount: number;
        requested_by: string;
        decision: string;
      }
    | undefined;
  if (!a) fail("Deviz inexistent.", 404);
  const w = work(db, p, a.work_order_id);
  requireRole(db, p, a.organization_id, ["owner", "approver"], w.property_id);
  if (p.admin) fail("Adminul nu aprobă costuri în numele clientului.", 403);
  const org = organization(db, p, a.organization_id);
  if (org.separate_approver && a.requested_by === p.id)
    fail("Este necesar un alt aprobator.", 403);
  if (["completed", "cancelled"].includes(w.status))
    fail("Lucrare închisă.", 409);
  if (
    a.decision !== "pending" ||
    w.quote_version !== a.quote_version ||
    w.estimate !== a.amount
  )
    fail("Devizul nu mai este în așteptare.", 409);
  if (
    !["approved", "rejected", "changes_requested"].includes(String(b.decision))
  )
    fail("Decizie invalidă.");
  if (b.amount !== a.amount) fail("Confirmă suma exactă.", 409);
  const note = text(b.note, "Comentariu", 2000);
  db.prepare(
    "UPDATE pro_approvals SET decision=?,decided_by=?,note=?,decided_at=? WHERE id=?",
  ).run(b.decision, p.id, note, now(), id);
  db.prepare(
    "UPDATE pro_work_orders SET financial_status=?,revision=revision+1 WHERE id=?",
  ).run(b.decision, w.id);
  db.prepare("UPDATE pro_tickets SET status=? WHERE work_order_id=?").run(
    b.decision === "approved" ? "approved" : "awaiting_quote",
    w.id,
  );
  audit(db, p, a.organization_id, id, `quote.${b.decision}`, {
    amount: a.amount,
    version: a.quote_version,
  });
  notify(
    db,
    w.organization_id,
    w.property_id,
    `${id}:decision`,
    "Decizie asupra devizului",
    `/pro/lucrari/${w.id}`,
  );
  return { id };
}
export function createOrg(
  db: Database,
  p: Principal,
  b: Record<string, unknown>,
) {
  if (!p.admin) fail("Activare numai prin operatorul administrativ.", 403);
  const ownerId = text(b.owner_id, "Owner");
  if (!db.prepare("SELECT 1 FROM users WHERE id=?").get(ownerId))
    fail("Owner inexistent.");
  const id = randomUUID();
  db.prepare(
    "INSERT INTO pro_organizations(id,name,city,contract_ref,created_at) VALUES(?,?,?,?,?)",
  ).run(
    id,
    text(b.name, "Organizație"),
    text(b.city, "Oraș"),
    text(b.contract_ref, "Referință contract"),
    now(),
  );
  db.prepare(
    "INSERT INTO pro_members(id,organization_id,user_id,role) VALUES(?,?,?,?)",
  ).run(randomUUID(), id, ownerId, "owner");
  audit(db, p, id, id, "organization.created");
  return { id };
}
export function createProperty(
  db: Database,
  p: Principal,
  b: Record<string, unknown>,
) {
  const orgId = text(b.organization_id, "Organizație");
  requireRole(db, p, orgId, ["owner", "operator"]);
  organization(db, p, orgId);
  const id = randomUUID();
  db.prepare(
    "INSERT INTO pro_properties(id,organization_id,name,city,address,postal_code,floor,threshold) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    id,
    orgId,
    text(b.name, "Nume"),
    text(b.city, "Oraș"),
    text(b.address, "Adresă"),
    typeof b.postal_code === "string" ? b.postal_code.slice(0, 30) : "",
    typeof b.floor === "string" ? b.floor.slice(0, 30) : "",
    b.threshold == null ? null : int(b.threshold, "Prag"),
  );
  audit(db, p, orgId, id, "property.created");
  return { id };
}
export function createTicket(
  db: Database,
  p: Principal,
  b: Record<string, unknown>,
) {
  const prop = property(db, p, text(b.property_id, "Proprietate"), [
    "owner",
    "manager",
    "operator",
  ]);
  const id = randomUUID();
  if (!["normal", "urgent", "critical"].includes(String(b.priority)))
    fail("Prioritate invalidă.");
  db.prepare(
    "INSERT INTO pro_tickets(id,organization_id,property_id,title,description,priority,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    id,
    prop.organization_id,
    prop.id,
    text(b.title, "Titlu"),
    text(b.description, "Descriere", 2000),
    b.priority,
    p.id,
    now(),
  );
  audit(db, p, prop.organization_id, id, "ticket.created");
  notify(
    db,
    prop.organization_id,
    prop.id,
    id,
    "Problemă raportată",
    `/pro/tichete/${id}`,
  );
  return { id };
}
export function ticketCommand(
  db: Database,
  p: Principal,
  id: string,
  action: string,
  b: Record<string, unknown>,
) {
  const t = ticket(db, p, id);
  requireRole(
    db,
    p,
    t.organization_id,
    ["owner", "manager", "operator"],
    t.property_id,
  );
  if (action === "create-work") {
    requireRole(db, p, t.organization_id, ["operator"], t.property_id);
    if (!["triaged", "awaiting_quote"].includes(t.status))
      fail("Triază tichetul înainte de ofertare.", 409);
    if (t.work_order_id) fail("Tichetul are deja o lucrare.", 409);
    const w = createWork(db, p, {
      ...b,
      property_id: t.property_id,
      title: t.title,
    });
    const row = work(db, p, w.id);
    db.prepare(
      "UPDATE pro_tickets SET work_order_id=?,status=? WHERE id=?",
    ).run(
      w.id,
      row.financial_status === "pending" ? "awaiting_approval" : "approved",
      id,
    );
  } else {
    const to = text(b.status, "Status");
    const map: Record<string, string[]> = {
      open: ["triaged", "cancelled"],
      triaged: ["awaiting_quote", "resolved", "cancelled"],
      awaiting_quote: ["cancelled"],
      resolved: ["closed", "triaged"],
      closed: [],
      cancelled: [],
    };
    if (!map[t.status]?.includes(to)) fail("Tranziție tichet nepermisă.", 409);
    text(b.note, "Motiv", 2000);
    db.prepare("UPDATE pro_tickets SET status=? WHERE id=?").run(to, id);
  }
  audit(db, p, t.organization_id, id, `ticket.${action}`, {
    note: b.note ?? "",
  });
  return { id };
}
export function listOrganizations(db: Database, p: Principal) {
  return p.admin
    ? (db
        .prepare("SELECT * FROM pro_organizations ORDER BY name")
        .all() as Org[])
    : (db
        .prepare(
          "SELECT DISTINCT o.* FROM pro_organizations o JOIN pro_members m ON m.organization_id=o.id WHERE m.user_id=? AND m.active=1 ORDER BY o.name",
        )
        .all(p.id) as Org[]);
}
export function workView(db: Database, p: Principal, w: Work) {
  const canOrg =
    p.admin ||
    allowed(
      db,
      p,
      w.organization_id,
      ["owner", "manager", "operator"],
      w.property_id,
    );
  const prop = db
    .prepare(
      "SELECT name,city,address,instructions FROM pro_properties WHERE id=?",
    )
    .get(w.property_id) as {
    name: string;
    city: string;
    address: string;
    instructions: string;
  };
  const partner =
    !!w.partner_id && partnerIds(db, p).includes(w.partner_id) && activeWork(w);
  const canSensitive = canOrg || partner;
  if (canSensitive)
    audit(db, p, w.organization_id, w.id, "work.sensitive_view");
  const offeredPartner =
    w.status === "offered" &&
    (
      db
        .prepare(
          "SELECT partner_id FROM pro_offers WHERE work_order_id=? AND status='offered' AND expires_at>?",
        )
        .all(w.id, now()) as { partner_id: string }[]
    ).some((o) => partnerIds(db, p).includes(o.partner_id));
  const moneyAllowed =
    canOrg ||
    partner ||
    offeredPartner ||
    allowed(db, p, w.organization_id, ["approver"], w.property_id);
  return {photoRules:workPhotoRules(db,w.id),
    ...w,
    estimate: moneyAllowed ? w.estimate : undefined,
    final_cost: moneyAllowed ? w.final_cost : undefined,
    threshold_snapshot: canOrg ? w.threshold_snapshot : undefined,
    property: {
      name: prop.name,
      city: prop.city,
      ...(canSensitive
        ? { address: prop.address, instructions: prop.instructions }
        : {}),
    },
    permissions: {
      manage: canOrg,
      operator:
        !!p.admin ||
        allowed(db, p, w.organization_id, ["operator"], w.property_id),
      partner,
      offer: offeredPartner,
      approve:
        !p.admin &&
        allowed(db, p, w.organization_id, ["owner", "approver"], w.property_id),
    },
  };
}
export function collection(
  db: Database,
  p: Principal,
  orgId: string,
  kind: string,
  filters: {
    from?: string;
    to?: string;
    property?: string;
    category?: string;
  } = {},
) {
  organization(db, p, orgId);
  const scope = (prop: string) =>
    p.admin ||
    allowed(
      db,
      p,
      orgId,
      ["owner", "manager", "approver", "viewer", "contact", "operator"],
      prop,
    );
  const roleScope = (propertyId: string | null, roles: Role[]) =>
    Boolean(p.admin) || allowed(db, p, orgId, roles, propertyId);
  if (kind === "properties")
    return (
      db
        .prepare(
          "SELECT id,organization_id,name,city,status,postal_code,floor FROM pro_properties WHERE organization_id=? ORDER BY name LIMIT 500",
        )
        .all(orgId) as Property[]
    ).filter((r) => scope(r.id));
  if (kind === "work-orders")
    return (
      db
        .prepare(
          "SELECT * FROM pro_work_orders WHERE organization_id=? ORDER BY starts_at LIMIT 500",
        )
        .all(orgId) as Work[]
    )
      .filter((r) => scope(r.property_id))
      .map((w) => {
        const { property: prop, ...v } = workView(db, p, w);
        return { ...v, property: { name: prop.name, city: prop.city } };
      });
  if (kind === "tickets")
    return (
      db
        .prepare(
          "SELECT * FROM pro_tickets WHERE organization_id=? ORDER BY created_at DESC LIMIT 500",
        )
        .all(orgId) as Ticket[]
    ).filter((t) => scope(t.property_id));
  if (kind === "approvals") {
    requireRole(db, p, orgId, ["owner", "approver", "operator"]);
    return (
      db
        .prepare(
          "SELECT a.*,w.property_id,w.title FROM pro_approvals a JOIN pro_work_orders w ON w.id=a.work_order_id WHERE a.organization_id=? ORDER BY a.created_at DESC LIMIT 500",
        )
        .all(orgId) as { property_id: string }[]
    ).filter((x) => roleScope(x.property_id, ["owner", "approver", "operator"]));
  }
  if (kind === "costs") {
    requireRole(db, p, orgId, ["owner", "manager", "operator"]);
    for (const d of [filters.from, filters.to])
      if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || bookingDateKey(d) !== d)) fail("Perioadă invalidă.");
    if(filters.from && filters.to && filters.from > filters.to) fail("Perioadă inversată.");
    const rows =
      db
        .prepare(
          "SELECT c.*,p.name property_name FROM pro_cost_entries c LEFT JOIN pro_properties p ON p.id=c.property_id WHERE c.organization_id=? AND (?='' OR substr(c.created_at,1,10)>=?) AND (?='' OR substr(c.created_at,1,10)<=?) AND (?='' OR c.property_id=?) AND (?='' OR c.category=?) ORDER BY c.created_at DESC,c.id DESC",
        )
        .iterate(
          orgId,
          filters.from ?? "",
          filters.from ?? "",
          filters.to ?? "",
          filters.to ?? "",
          filters.property ?? "",
          filters.property ?? "",
          filters.category ?? "",
          filters.category ?? "",
        ) as Iterable<{ property_id: string | null }>;
    const result: {property_id: string | null}[] = [];
    for (const row of rows) {
      if (!roleScope(row.property_id, ["owner", "manager", "operator"])) continue;
      result.push(row);
      if (result.length > 1000)
        fail("Raportul depășește 1.000 de înregistrări. Restrânge perioada, proprietatea sau categoria pentru un raport complet.", 422);
    }
    return result;
  }
  if (kind === "team") {
    requireRole(db, p, orgId, ["owner", "operator"]);
    return db
      .prepare(
        "SELECT m.*,u.name,u.email FROM pro_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=?",
      )
      .all(orgId);
  }
  if (kind === "recurring") {
    requireRole(db, p, orgId, ["owner", "manager", "operator"]);
    return (
      db
        .prepare("SELECT * FROM pro_recurring_rules WHERE organization_id=?")
        .all(orgId) as { property_id: string }[]
    ).filter((x) => roleScope(x.property_id, ["owner", "manager", "operator"]));
  }
  fail("Listă inexistentă.", 404);
}
export function credential(db: Database, p: Principal, workId: string) {
  const w = work(db, p, workId);
  if (
    !activeWork(w) ||
    Date.now() < +new Date(w.starts_at) - 2 * 3600000 ||
    Date.now() > +new Date(w.ends_at)
  )
    fail("Codul nu este disponibil în acest interval.", 403);
  if (!(
    p.admin ||
    allowed(
      db,
      p,
      w.organization_id,
      ["owner", "manager", "operator"],
      w.property_id,
    ) ||
    (w.partner_id && partnerIds(db, p).includes(w.partner_id))
  ))
    fail("Acces interzis.", 403);
  const c = db
    .prepare("SELECT * FROM pro_access_credentials WHERE property_id=?")
    .get(w.property_id) as
    { ciphertext: string; key_version: string } | undefined;
  if (!c) fail("Nu există cod salvat.", 404);
  const key = process.env.NITIDO_PRO_ACCESS_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    fail("Codurile sunt dezactivate.", 503);
  const [iv, tag, data] = c.ciphertext.split(".");
  const d = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "hex"),
  );
  d.setAAD(Buffer.from(w.property_id));
  d.setAuthTag(Buffer.from(tag, "hex"));
  const secret = Buffer.concat([
    d.update(Buffer.from(data, "hex")),
    d.final(),
  ]).toString();
  audit(db, p, w.organization_id, w.id, "credential.view");
  return { secret };
}
export function saveCredential(
  db: Database,
  p: Principal,
  id: string,
  b: Record<string, unknown>,
) {
  const prop = property(db, p, id, ["owner"]);
  const key = process.env.NITIDO_PRO_ACCESS_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    fail(
      "Configurarea criptării este necesară înainte de salvarea codurilor.",
      503,
    );
  const secret = text(b.secret, "Cod acces", 300),
    iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  c.setAAD(Buffer.from(id));
  const data = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  const encrypted = [
    iv.toString("hex"),
    c.getAuthTag().toString("hex"),
    data.toString("hex"),
  ].join(".");
  db.prepare(
    "INSERT INTO pro_access_credentials VALUES(?,?,?,?) ON CONFLICT(property_id) DO UPDATE SET ciphertext=excluded.ciphertext,key_version=excluded.key_version,updated_at=excluded.updated_at",
  ).run(id, encrypted, "1", now());
  audit(db, p, prop.organization_id, id, "credential.updated");
  return { id };
}
function recurringInstant(day: string, hour: number): string {
  try { return hostLocalInstant(day, hour); }
  catch { throw new ProError("Data sau ora programării nu există în calendarul României."); }
}
export function createRecurring(
  db: Database,
  p: Principal,
  b: Record<string, unknown>,
) {
  const prop = property(db, p, text(b.property_id, "Proprietate"), [
    "owner",
    "manager",
    "operator",
  ]);
  const frequency = text(b.frequency, "Frecvență");
  if (!["weekly", "biweekly", "monthly"].includes(frequency))
    fail("Frecvență invalidă.");
  const day = text(b.start_date, "Data");
  const hour = int(b.hour, "Ora", 0, 23);
  const firstInstant = recurringInstant(day, hour);
  if (Date.parse(firstInstant) < Date.now()) fail("Data sau ora este în trecut.");
  const service = text(b.service, "Serviciu");
  if (!(service in SERVICES) || service === "cleaning_turnover")
    fail("Turnover se programează manual.");
  const id = randomUUID();
  db.prepare(
    "INSERT INTO pro_recurring_rules(id,organization_id,property_id,title,service,frequency,next_date,anchor_day,hour,duration,estimate,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    prop.organization_id,
    prop.id,
    text(b.title, "Titlu"),
    service,
    frequency,
    day,
    Number(day.slice(-2)),
    hour,
    int(b.duration, "Durată", 15, 720),
    int(b.estimate, "Cost"),
    p.id,
  );
  audit(db, p, prop.organization_id, id, "recurring.created");
  return { id };
}
export function runRecurring(db: Database, stamp = Date.now()) {
  return db
    .transaction(() => {
      let generated = 0,
        missed = 0;
      const horizon = bucharestDateKey(new Date(stamp + 14 * 86400000));
      const rules = db
        .prepare(
          "SELECT r.* FROM pro_recurring_rules r JOIN pro_organizations o ON o.id=r.organization_id JOIN pro_properties p ON p.id=r.property_id WHERE r.active=1 AND o.status='active' AND p.status='active'",
        )
        .all() as {
        id: string;
        organization_id: string;
        property_id: string;
        title: string;
        service: string;
        frequency: string;
        next_date: string;
        anchor_day: number;
        hour: number;
        duration: number;
        estimate: number;
        created_by: string;
        end_date: string | null;
      }[];
      for (const r of rules) {
        let day = r.next_date;
        let guard = 0;
        while (
          day <= horizon &&
          (!r.end_date || day <= r.end_date) &&
          guard++ < 400
        ) {
          if (
            !db
              .prepare(
                "SELECT 1 FROM pro_occurrences WHERE rule_id=? AND day=?",
              )
              .get(r.id, day)
          ) {
            try {
              const starts = recurringInstant(day, r.hour);
              if (+new Date(starts) < stamp) throw new ProError("Programarea este în trecut.");
              db.transaction(() => {
                const result = createWork(
                  db,
                  { id: r.created_by },
                  {
                    property_id: r.property_id,
                    title: r.title,
                    service: r.service,
                    starts_at: starts,
                    ends_at: new Date(
                      +new Date(starts) + r.duration * 60000,
                    ).toISOString(),
                    estimate: r.estimate,
                  },
                );
                db.prepare(
                  "INSERT INTO pro_occurrences VALUES(?,?,?,'generated')",
                ).run(r.id, day, result.id);
              })();
              generated++;
            } catch (error) {
              // Storage failures must roll back and retry, never consume the occurrence.
              if (!(error instanceof ProError) || error.status >= 500) throw error;
              db.prepare(
                "INSERT INTO pro_occurrences VALUES(?,?,NULL,'missed')",
              ).run(r.id, day);
              notify(
                db,
                r.organization_id,
                r.property_id,
                `${r.id}:${day}:missed`,
                "O programare recurentă necesită verificare",
                "/pro/calendar",
              );
              missed++;
            }
          }
          const d = new Date(day + "T12:00:00Z");
          if (r.frequency === "monthly") {
            d.setUTCDate(1);
            d.setUTCMonth(d.getUTCMonth() + 1);
            const last = new Date(
              Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
            ).getUTCDate();
            d.setUTCDate(Math.min(r.anchor_day, last));
          } else
            d.setUTCDate(d.getUTCDate() + (r.frequency === "weekly" ? 7 : 14));
          day = d.toISOString().slice(0, 10);
        }
        db.prepare("UPDATE pro_recurring_rules SET next_date=? WHERE id=?").run(
          day,
          r.id,
        );
      }
      const expired = db
        .prepare(
          "SELECT o.id,o.organization_id,o.work_order_id,w.property_id FROM pro_offers o JOIN pro_work_orders w ON w.id=o.work_order_id WHERE o.status='offered' AND o.expires_at<=?",
        )
        .all(new Date(stamp).toISOString()) as {
        id: string;
        organization_id: string;
        work_order_id: string;
        property_id: string;
      }[];
      for (const o of expired) {
        db.prepare("UPDATE pro_offers SET status='expired' WHERE id=?").run(
          o.id,
        );
        db.prepare(
          "UPDATE pro_work_orders SET status='scheduled',revision=revision+1 WHERE id=? AND status='offered'",
        ).run(o.work_order_id);
        audit(
          db,
          { id: "system" },
          o.organization_id,
          o.work_order_id,
          "offer.expired",
        );
        notify(
          db,
          o.organization_id,
          o.property_id,
          `${o.id}:expired`,
          "O ofertă a expirat",
          `/pro/lucrari/${o.work_order_id}`,
        );
      }
      return { generated, missed, expired: expired.length };
    })
    .immediate();
}

/** Preserve occurrence identity when moving only a scheduled visit. */
export function reschedule(
  db: Database,
  p: Principal,
  id: string,
  b: Record<string, unknown>,
) {
  const w = work(db, p, id);
  requireRole(
    db,
    p,
    w.organization_id,
    ["owner", "manager", "operator"],
    w.property_id,
  );
  if (w.status !== "scheduled" || w.revision !== b.revision)
    fail("Numai lucrările programate, neofertate, pot fi mutate.", 409);
  const start = new Date(text(b.starts_at, "Început")),
    end = new Date(text(b.ends_at, "Sfârșit"));
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    +start < Date.now() ||
    +end <= +start ||
    +end - +start > 12 * 3600000
  )
    fail("Interval invalid.");
  if (
    db
      .prepare(
        "SELECT 1 FROM pro_work_orders WHERE id<>? AND property_id=? AND status NOT IN ('completed','cancelled') AND starts_at<? AND ends_at>?",
      )
      .get(id, w.property_id, end.toISOString(), start.toISOString())
  )
    fail("Interval ocupat.", 409);
  db.prepare(
    "UPDATE pro_work_orders SET starts_at=?,ends_at=?,revision=revision+1 WHERE id=?",
  ).run(start.toISOString(), end.toISOString(), id);
  audit(db, p, w.organization_id, id, "work.rescheduled", {
    previous_start: w.starts_at,
    previous_end: w.ends_at,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
  });
  return { id };
}
