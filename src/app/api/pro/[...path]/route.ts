import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminAuth";
import { hasTrustedMutationOrigin, constantTimeEqual } from "@/lib/security";
import { emailIsVerified } from "@/lib/emailVerification";
import { emailConfigured, sendEmail } from "@/lib/email";
import * as pro from "@/lib/pro/core";
import { csvCell, SERVICES } from "@/lib/pro/shared";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ path: string[] }> };
const uploadDir = () => path.join(process.cwd(), "data", "pro-uploads");
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const error = (e: unknown) =>
  e instanceof SyntaxError
    ? json({ error: "Date JSON invalide." }, 422)
    : e instanceof pro.ProError
      ? json({ error: e.message }, e.status)
      : json({ error: "Operațiunea nu a fost confirmată. Reîncearcă." }, 503);
async function principal(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (user) return { id: user.id };
  if (await isAdmin()) return { id: "admin", admin: true };
  throw new pro.ProError("Autentificare necesară.", 401);
}
function enabled(publicOnly = false) {
  if (
    process.env[
      publicOnly ? "NEXT_PUBLIC_NITIDO_PRO_PUBLIC" : "NITIDO_PRO_ENABLED"
    ] !== "true"
  )
    pro.fail("Modulul Pro nu este activ.", 404);
  pro.ready(db);
}
function mediaAccess(
  p: pro.Principal,
  m: { work_order_id: string | null; ticket_id: string | null },
) {
  if (m.work_order_id) {
    const w = pro.work(db, p, m.work_order_id);
    if (
      !p.admin &&
      !pro.allowed(
        db,
        p,
        w.organization_id,
        ["owner", "manager", "operator", "approver"],
        w.property_id,
      ) &&
      !(
        w.partner_id &&
        pro.partnerIds(db, p).includes(w.partner_id) &&
        pro.activeWork(w)
      )
    )
      pro.fail("Acces interzis.", 404);
    return w.organization_id;
  }
  const t = pro.ticket(db, p, m.ticket_id!);
  return t.organization_id;
}
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    enabled();
    const p = await principal(req),
      segments = (await ctx.params).path,
      [kind, id] = segments;
    pro.limit(db, `read:${p.id}`, 240);
    const org = req.nextUrl.searchParams.get("organization_id") ?? "";
    const filters = {
      from: req.nextUrl.searchParams.get("from") ?? "",
      to: req.nextUrl.searchParams.get("to") ?? "",
      property: req.nextUrl.searchParams.get("property") ?? "",
      category: req.nextUrl.searchParams.get("category") ?? "",
    };
    if (kind === "context")
      return json({
        organizations: pro.listOrganizations(db, p),
        partners: pro.partnerIds(db, p),
        admin: !!p.admin,
        user_id: p.id,
      });
    if (kind === "media" && id) {
      const m = db.prepare("SELECT * FROM pro_media WHERE id=?").get(id) as
        | {
            filename: string;
            mime: string;
            work_order_id: string | null;
            ticket_id: string | null;
            organization_id: string;
          }
        | undefined;
      if (!m) pro.fail("Fișier inexistent.", 404);
      mediaAccess(p, m);
      if (path.basename(m.filename) !== m.filename)
        pro.fail("Fișier invalid.", 404);
      const file = path.join(uploadDir(), m.filename);
      if (!fs.existsSync(file)) pro.fail("Fișier indisponibil.", 404);
      pro.audit(db, p, m.organization_id, id, "media.view");
      return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
        headers: {
          "Content-Type": m.mime,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (kind === "invites") {
      pro.requireRole(db, p, org, ["owner"]);
      return json(
        db
          .prepare(
            "SELECT id,email,role,expires_at,used_at,revoked FROM pro_invites WHERE organization_id=? ORDER BY expires_at DESC",
          )
          .all(org),
      );
    }
    if (kind === "notifications") {
      const rows = db.prepare(
        "SELECT * FROM pro_notifications WHERE user_id=? ORDER BY created_at DESC,id DESC",
      ).iterate(p.id) as Iterable<pro.NotificationTarget & {
        id: string; title: string; read_at: string | null; email_status: string; created_at: string;
      }>;
      const visible = [];
      for (const row of rows) {
        if (!pro.notificationAllowed(db, p, row)) continue;
        const { id, title, href, read_at, email_status, created_at } = row;
        visible.push({ id, title, href, read_at, email_status, created_at });
        if (visible.length === 100) break;
      }
      return json(visible);
    }
    if (kind === "partner")
      return json(pro.partnerWork(db, p).map(w => pro.workView(db, p, w)));
    if (kind === "partners") {
      pro.requireRole(db, p, org, ["operator"]);
      return json(
        db
          .prepare(
            "SELECT id,name,status,cities_json,services_json FROM pro_partners ORDER BY name",
          )
          .all(),
      );
    }
    if (kind === "leads") {
      if (!p.admin) pro.fail("Acces interzis.", 403);
      return json(
        db
          .prepare("SELECT * FROM pro_leads ORDER BY created_at DESC LIMIT 200")
          .all(),
      );
    }
    if (kind === "work-orders" && id) {
      const w = pro.work(db, p, id);
      if (segments[2] === "credential") return json(pro.credential(db, p, id));
      const media = mediaAccess.bind(null, p);
      const files = db
        .prepare(
          "SELECT id,category,created_at,work_order_id,ticket_id FROM pro_media WHERE work_order_id=?",
        )
        .all(id) as {
        id: string;
        category: string;
        work_order_id: string;
        ticket_id: null;
      }[];
      let photos: typeof files = [];
      try {
        media({ work_order_id: id, ticket_id: null });
        photos = files;
      } catch {
        /* Offer preview never discloses photographs. */
      }
      const view = pro.workView(db, p, w);
      return json({
        ...view,
        media: photos,
        audit: db
          .prepare(
            "SELECT action,created_at FROM pro_audit_logs WHERE entity_id=? ORDER BY created_at DESC LIMIT 60",
          )
          .all(id),
        approvals:
          view.permissions.approve || view.permissions.manage
            ? db
                .prepare(
                  "SELECT * FROM pro_approvals WHERE work_order_id=? ORDER BY quote_version DESC",
                )
                .all(id)
            : [],
      });
    }
    if (kind === "tickets" && id) {
      const t = pro.ticket(db, p, id);
      return json({
        ...t,
        media: db
          .prepare("SELECT id,category FROM pro_media WHERE ticket_id=?")
          .all(id),
      });
    }
    if (kind === "properties" && id) {
      const prop = pro.property(db, p, id);
      const sensitive =
        p.admin ||
        pro.allowed(
          db,
          p,
          prop.organization_id,
          ["owner", "manager", "operator"],
          id,
        );
      if (sensitive)
        pro.audit(db, p, prop.organization_id, id, "property.sensitive_view");
      return json(
        sensitive
          ? prop
          : {
              id: prop.id,
              name: prop.name,
              city: prop.city,
              status: prop.status,
            },
      );
    }
    if (kind === "reports" && id === "export") {
      const rows = pro.collection(db, p, org, "costs", filters) as {
        created_at: string;
        property_name: string;
        category: string;
        amount: number;
        currency: string;
        status: string;
      }[];
      const csv = [
        ["Data", "Proprietate", "Categorie", "Suma RON", "Moneda", "Stare"],
        ...rows.map((r) => [
          r.created_at,
          r.property_name,
          r.category,
          (r.amount / 100).toFixed(2),
          r.currency,
          r.status,
        ]),
      ]
        .map((r) => r.map(csvCell).join(","))
        .join("\r\n");
      pro.audit(db, p, org, org, "report.export");
      return new NextResponse("\uFEFF" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="nitido-pro-costuri.csv"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    return json(pro.collection(db, p, org, kind, filters));
  } catch (e) {
    return error(e);
  }
}
async function dispatchEmails() {
  if (!emailConfigured()) return { sent: 0, configured: false };
  let sent = 0;
  const stamp = new Date().toISOString();
  db.prepare(
    "UPDATE pro_notifications SET email_status='pending' WHERE email_status='sending' AND lease_until<?",
  ).run(stamp);
  const candidates = db
    .prepare(
      "SELECT n.*,u.email FROM pro_notifications n JOIN users u ON u.id=n.user_id WHERE n.email_status IN ('pending','failed') AND n.attempts<5 AND n.next_attempt<=? ORDER BY n.created_at LIMIT 20",
    )
    .all(stamp) as {
    id: string;
    email: string;
    title: string;
    href: string;
    attempts: number;
    organization_id: string;
    user_id: string;
    event_key: string;
  }[];
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base || !base.startsWith("https://"))
    return { sent: 0, configured: false };
  for (const n of candidates) {
    if (!n.email) continue;
    if (!pro.notificationAllowed(db, { id: n.user_id }, n)) {
      db.prepare(
        "UPDATE pro_notifications SET email_status='disabled',lease_until=NULL WHERE id=?",
      ).run(n.id);
      continue;
    }
    const claim = db
      .prepare(
        "UPDATE pro_notifications SET email_status='sending',lease_until=?,attempts=attempts+1 WHERE id=? AND email_status IN ('pending','failed')",
      )
      .run(new Date(Date.now() + 60000).toISOString(), n.id);
    if (!claim.changes) continue;
    const href = new URL(n.href, base).href
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;");
    const accepted = await sendEmail({
      to: n.email,
      subject: "NITIDO Pro — ai o actualizare",
      html: `<p>O operațiune necesită atenția ta.</p><p><a href="${href}">Deschide NITIDO Pro</a></p>`,
    });
    db.prepare(
      "UPDATE pro_notifications SET email_status=?,next_attempt=?,lease_until=NULL WHERE id=?",
    ).run(
      accepted ? "sent" : "failed",
      new Date(
        Date.now() + Math.min(86400000, 60000 * 2 ** n.attempts),
      ).toISOString(),
      n.id,
    );
    if (accepted) sent++;
  }
  return { sent, configured: true };
}
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const segments = (await ctx.params).path,
      [kind, id, action] = segments;
    if (kind === "cron") {
      enabled();
      const secret = process.env.CRON_SECRET;
      if (
        !secret ||
        !constantTimeEqual(req.headers.get("x-cron-secret") ?? "", secret)
      )
        pro.fail("Neautorizat.", 401);
      return json({ ...pro.runRecurring(db), email: await dispatchEmails() });
    }
    if (kind === "leads" && !id) {
      enabled(true);
      if (!hasTrustedMutationOrigin(req)) pro.fail("Origine invalidă.", 403);
      pro.limit(
        db,
        `lead:${req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"}`,
        5,
        600000,
      );
      const raw = await req.text();
      if (raw.length > 15000) pro.fail("Formular prea mare.");
      const b = JSON.parse(raw) as Record<string, unknown>;
      if (b.consent !== true) pro.fail("Confirmă acordul de contact.");
      const kind = b.kind === "partner" ? "partner" : "client",
        count =
          kind === "client"
            ? pro.int(b.property_count, "Număr proprietăți", 5, 100000)
            : null;
      const email = pro.text(b.email, "Email");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) pro.fail("Email invalid.");
      const leadId = randomUUID();
      db.prepare(
        "INSERT INTO pro_leads(id,kind,name,email,phone,city,property_count,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      ).run(
        leadId,
        kind,
        pro.text(b.name, "Nume"),
        email,
        pro.text(b.phone, "Telefon", 40),
        pro.text(b.city, "Zonă"),
        count,
        JSON.stringify(b),
        new Date().toISOString(),
      );
      return json({ id: leadId }, 201);
    }
    enabled();
    const p = await principal(req);
    if (!hasTrustedMutationOrigin(req)) pro.fail("Origine invalidă.", 403);
    pro.limit(db, `write:${p.id}`, 40);
    if (kind === "media") {
      const length = Number(req.headers.get("content-length") ?? 0);
      if (length > 9 * 1024 * 1024) pro.fail("Fișier prea mare.");
      const form = await req.formData(),
        file = form.get("file"),
        workId = form.get("work_order_id"),
        ticketId = form.get("ticket_id");
      if (
        !!workId === !!ticketId ||
        !(file instanceof File) ||
        file.size > 8 * 1024 * 1024 ||
        !file.size
      )
        pro.fail("Încarcă o singură imagine de maximum 8 MB.");
      const ref = {
        work_order_id: typeof workId === "string" ? workId : null,
        ticket_id: typeof ticketId === "string" ? ticketId : null,
      };
      const org = mediaAccess(p, ref);
      if (ref.work_order_id) {
        const w = pro.work(db, p, ref.work_order_id);
        if (
          !p.admin &&
          !pro.allowed(
            db,
            p,
            org,
            ["owner", "manager", "operator"],
            w.property_id,
          ) &&
          !(
            w.partner_id &&
            pro.partnerIds(db, p).includes(w.partner_id) &&
            w.status === "in_progress"
          )
        )
          pro.fail("Nu poți încărca aici.", 403);
        if (["completed", "cancelled"].includes(w.status))
          pro.fail("Lucrare închisă.", 409);
      } else {
        const t = pro.ticket(db, p, ref.ticket_id!);
        pro.requireRole(
          db,
          p,
          org,
          ["owner", "manager", "operator"],
          t.property_id,
        );
      }
      const input = Buffer.from(await file.arrayBuffer());
      const meta = await sharp(input, {
        limitInputPixels: 40000000,
      }).metadata();
      if (
        !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
        file.type !==
          (
            {
              jpeg: "image/jpeg",
              png: "image/png",
              webp: "image/webp",
            } as Record<string, string>
          )[meta.format ?? ""]
      )
        pro.fail("Format imagine nepermis.");
      const buffer = await sharp(input, { limitInputPixels: 40000000 })
        .rotate()
        .resize({
          width: 2560,
          height: 2560,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp()
        .toBuffer();
      const hash = createHash("sha256").update(buffer).digest("hex");
      const category = String(form.get("category"));
      if (
        ![
          "before",
          "after",
          "issue",
          "quote",
          "resolution",
          "inventory",
        ].includes(category)
      )
        pro.fail("Categorie invalidă.");
      const mediaId = randomUUID(),
        filename = mediaId + ".webp";
      fs.mkdirSync(uploadDir(), { recursive: true });
      try {
        db.transaction(() => {
          mediaAccess(p, ref);
          if (ref.work_order_id) {
            const current = pro.work(db, p, ref.work_order_id);
            if (["completed", "cancelled"].includes(current.status))
              pro.fail("Lucrare închisă.", 409);
            if (
              !p.admin &&
              !pro.allowed(
                db,
                p,
                org,
                ["owner", "manager", "operator"],
                current.property_id,
              ) &&
              current.status !== "in_progress"
            )
              pro.fail("Execuția nu este activă.", 409);
          }
          const count = db
            .prepare(
              "SELECT COUNT(*) n FROM pro_media WHERE work_order_id=? OR ticket_id=?",
            )
            .get(ref.work_order_id, ref.ticket_id) as { n: number };
          if (count.n >= 20) pro.fail("Maximum 20 fotografii.", 409);
          if (
            db
              .prepare(
                "SELECT 1 FROM pro_media WHERE (work_order_id=? OR ticket_id=?) AND hash=? AND category=?",
              )
              .get(ref.work_order_id, ref.ticket_id, hash, category)
          )
            pro.fail("Fotografia este deja încărcată.", 409);
          fs.writeFileSync(path.join(uploadDir(), filename), buffer, {
            flag: "wx",
            mode: 0o600,
          });
          db.prepare("INSERT INTO pro_media VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(
            mediaId,
            org,
            ref.work_order_id,
            ref.ticket_id,
            category,
            filename,
            "image/webp",
            buffer.length,
            hash,
            p.id,
            new Date().toISOString(),
          );
          pro.audit(
            db,
            p,
            org,
            ref.work_order_id ?? ref.ticket_id!,
            "media.upload",
            { media_id: mediaId },
          );
        }).immediate();
      } catch (e) {
        fs.rmSync(path.join(uploadDir(), filename), { force: true });
        throw e;
      }
      return json({ id: mediaId }, 201);
    }
    const raw = await req.text();
    if (raw.length > 20000) pro.fail("Cerere prea mare.");
    const b = JSON.parse(raw || "{}") as Record<string, unknown>;
    const key = req.headers.get("idempotency-key") ?? "";
    const result = pro.atomic(db, p, key, { segments, b }, () => {
      if (kind === "organizations" && !id) return pro.createOrg(db, p, b);
      if (kind === "properties" && !id) return pro.createProperty(db, p, b);
      if (kind === "properties" && id && action === "update") {
        const prop = pro.property(db, p, id, ["owner", "manager", "operator"]);
        const status = pro.text(b.status, "Stare");
        if (!["active", "inactive", "archived"].includes(status))
          pro.fail("Stare invalidă.");
        if (
          status !== "active" &&
          db
            .prepare(
              "SELECT 1 FROM pro_work_orders WHERE property_id=? AND status NOT IN ('completed','cancelled')",
            )
            .get(id)
        )
          pro.fail("Soluționează lucrările active înainte de arhivare.", 409);
        db.prepare(
          "UPDATE pro_properties SET name=?,address=?,postal_code=?,floor=?,instructions=?,status=?,threshold=? WHERE id=?",
        ).run(
          pro.text(b.name, "Nume"),
          pro.text(b.address, "Adresă"),
          typeof b.postal_code === "string" ? b.postal_code.slice(0, 30) : "",
          typeof b.floor === "string" ? b.floor.slice(0, 30) : "",
          typeof b.instructions === "string"
            ? b.instructions.slice(0, 2000)
            : "",
          status,
          b.threshold == null ? null : pro.int(b.threshold, "Prag"),
          id,
        );
        if (status !== "active") {
          db.prepare(
            "UPDATE pro_recurring_rules SET active=0 WHERE property_id=?",
          ).run(id);
          db.prepare(
            "DELETE FROM pro_access_credentials WHERE property_id=?",
          ).run(id);
        }
        pro.audit(db, p, prop.organization_id, id, "property.updated", {
          status,
        });
        return { id };
      }
      if (kind === "invites" && id && action === "revoke") {
        const inv = db
          .prepare("SELECT organization_id FROM pro_invites WHERE id=?")
          .get(id) as { organization_id: string } | undefined;
        if (!inv) pro.fail("Invitație inexistentă.", 404);
        pro.requireRole(db, p, inv.organization_id, ["owner"]);
        db.prepare("UPDATE pro_invites SET revoked=1 WHERE id=?").run(id);
        pro.audit(db, p, inv.organization_id, id, "invite.revoked");
        return { id };
      }
      if (kind === "staff" && id) {
        if (!p.admin) pro.fail("Acces interzis.", 403);
        pro.organization(db, p, id);
        const uid = pro.text(b.user_id, "Cont operator");
        if (!db.prepare("SELECT 1 FROM users WHERE id=?").get(uid))
          pro.fail("Cont inexistent.");
        db.prepare(
          "INSERT INTO pro_members(id,organization_id,user_id,role) VALUES(?,?,?,'operator') ON CONFLICT(organization_id,user_id,role) DO UPDATE SET active=1",
        ).run(randomUUID(), id, uid);
        pro.audit(db, p, id, uid, "operator.assigned");
        return { id };
      }
      if (kind === "partners" && id) {
        if (!p.admin) pro.fail("Acces interzis.", 403);
        if (!["active", "suspended", "inactive"].includes(String(b.status)))
          pro.fail("Stare invalidă.");
        const reason = pro.text(b.note, "Motiv", 2000);
        if (!db.prepare("SELECT 1 FROM pro_partners WHERE id=?").get(id))
          pro.fail("Partener inexistent.", 404);
        db.prepare("UPDATE pro_partners SET status=? WHERE id=?").run(
          b.status,
          id,
        );
        if (b.status !== "active") {
          const offers = db
            .prepare(
              "SELECT o.id,o.work_order_id,w.organization_id,w.property_id FROM pro_offers o JOIN pro_work_orders w ON w.id=o.work_order_id WHERE o.partner_id=? AND o.status='offered'",
            )
            .all(id) as {
            id: string;
            work_order_id: string;
            organization_id: string;
            property_id: string;
          }[];
          for (const o of offers) {
            db.prepare(
              "UPDATE pro_offers SET status='withdrawn' WHERE id=?",
            ).run(o.id);
            db.prepare(
              "UPDATE pro_work_orders SET status='scheduled',revision=revision+1 WHERE id=?",
            ).run(o.work_order_id);
            pro.notify(
              db,
              o.organization_id,
              o.property_id,
              o.id + ":suspension",
              "Oferta necesită realocare",
              "/pro/lucrari/" + o.work_order_id,
            );
          }
          const active = db
            .prepare(
              "SELECT * FROM pro_work_orders WHERE partner_id=? AND status NOT IN ('completed','cancelled')",
            )
            .all(id) as pro.Work[];
          for (const w of active)
            pro.notify(
              db,
              w.organization_id,
              w.property_id,
              w.id + ":suspension:" + w.revision,
              "Partener suspendat — verifică lucrarea",
              "/pro/lucrari/" + w.id,
            );
        }
        pro.audit(db, p, null, id, "partner.status", {
          status: b.status,
          reason,
        });
        return { id };
      }
      if (kind === "costs" && id) {
        const cost = db
          .prepare("SELECT * FROM pro_cost_entries WHERE id=?")
          .get(id) as
          { organization_id: string; property_id: string | null } | undefined;
        if (!cost) pro.fail("Cost inexistent.", 404);
        pro.requireRole(
          db,
          p,
          cost.organization_id,
          ["owner", "operator"],
          cost.property_id,
        );
        if (!["invoiced_external", "paid_external"].includes(String(b.status)))
          pro.fail("Stare invalidă.");
        const ref = pro.text(b.invoice_ref, "Referință document extern");
        db.prepare(
          "UPDATE pro_cost_entries SET status=?,invoice_ref=? WHERE id=?",
        ).run(b.status, ref, id);
        pro.audit(db, p, cost.organization_id, id, "cost.external_record", {
          status: b.status,
          ref,
        });
        return { id };
      }

      if (kind === "properties" && id && action === "credential")
        return pro.saveCredential(db, p, id, b);
      if (kind === "work-orders" && !id) return pro.createWork(db, p, b);
      if (kind === "work-orders" && id && action === "reschedule")
        return pro.reschedule(db, p, id, b);
      if (kind === "work-orders" && id && action)
        return pro.workCommand(db, p, id, action, b);
      if (kind === "approvals" && id) return pro.decide(db, p, id, b);
      if (kind === "tickets" && !id) return pro.createTicket(db, p, b);
      if (kind === "tickets" && id && action)
        return pro.ticketCommand(db, p, id, action, b);
      if (kind === "recurring" && !id) return pro.createRecurring(db, p, b);
      if (kind === "recurring" && id && action === "skip") {
        const r = db
          .prepare(
            "SELECT organization_id,property_id FROM pro_recurring_rules WHERE id=?",
          )
          .get(id) as
          { organization_id: string; property_id: string } | undefined;
        if (!r) pro.fail("Regulă inexistentă.", 404);
        pro.requireRole(
          db,
          p,
          r.organization_id,
          ["owner", "manager", "operator"],
          r.property_id,
        );
        const day = pro.text(b.day, "Data");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) pro.fail("Data invalidă.");
        if (
          db
            .prepare("SELECT 1 FROM pro_occurrences WHERE rule_id=? AND day=?")
            .get(id, day)
        )
          pro.fail(
            "Apariția există deja. Anulează sau reprogramează lucrarea asociată.",
            409,
          );
        db.prepare(
          "INSERT INTO pro_occurrences VALUES(?,?,NULL,'skipped')",
        ).run(id, day);
        pro.audit(db, p, r.organization_id, id, "recurring.skip", { day });
        return { id };
      }
      if (kind === "recurring" && id) {
        const r = db
          .prepare("SELECT * FROM pro_recurring_rules WHERE id=?")
          .get(id) as
          { organization_id: string; property_id: string } | undefined;
        if (!r) pro.fail("Regulă inexistentă.", 404);
        pro.requireRole(
          db,
          p,
          r.organization_id,
          ["owner", "manager", "operator"],
          r.property_id,
        );
        if (typeof b.active !== "boolean") pro.fail("Stare invalidă.");
        db.prepare("UPDATE pro_recurring_rules SET active=? WHERE id=?").run(
          b.active ? 1 : 0,
          id,
        );
        pro.audit(db, p, r.organization_id, id, "recurring.pause", {
          active: b.active,
        });
        return { id };
      }
      if (kind === "settings" && id) {
        pro.requireRole(db, p, id, ["owner"]);
        const o = pro.organization(db, p, id);
        if (typeof b.separate_approver !== "boolean")
          pro.fail("Regulă aprobator invalidă.");
        db.prepare(
          "UPDATE pro_organizations SET threshold=?,separate_approver=? WHERE id=?",
        ).run(pro.int(b.threshold, "Prag"), b.separate_approver ? 1 : 0, id);
        pro.audit(db, p, id, id, "settings.updated", {
          previous_threshold: o.threshold,
        });
        return { id };
      }
      if (kind === "activate" && id) {
        if (!p.admin) pro.fail("Activare numai de către NITIDO.", 403);
        pro.organization(db, p, id);
        if (
          !db
            .prepare("SELECT 1 FROM pro_properties WHERE organization_id=?")
            .get(id)
        )
          pro.fail("Adaugă proprietățile înainte de activare.");
        db.prepare(
          "UPDATE pro_organizations SET status='active' WHERE id=?",
        ).run(id);
        pro.audit(db, p, id, id, "organization.activated");
        return { id };
      }
      if (kind === "partners" && !id) {
        if (!p.admin) pro.fail("Acces interzis.", 403);
        const partnerId = randomUUID();
        const services = b.services,
          cities = b.cities;
        if (
          !Array.isArray(services) ||
          !services.length ||
          !services.every((s) => typeof s === "string" && s in SERVICES) ||
          !Array.isArray(cities) ||
          !cities.length ||
          !cities.every((c) => typeof c === "string" && c.length < 120)
        )
          pro.fail("Zone/servicii invalide.");
        const userId = pro.text(b.user_id, "Membru firmă");
        if (
          !db
            .prepare("SELECT 1 FROM users WHERE id=? AND role='firma'")
            .get(userId)
        )
          pro.fail("Este necesar un cont de firmă existent.");
        db.prepare("INSERT INTO pro_partners VALUES(?,?,?,'active',?,?,?)").run(
          partnerId,
          pro.text(b.name, "Firmă"),
          pro.text(b.legal_id, "CUI"),
          JSON.stringify(cities),
          JSON.stringify(services),
          pro.text(b.verified_ref, "Dovadă verificare"),
        );
        db.prepare("INSERT INTO pro_partner_members VALUES(?,?,1)").run(
          partnerId,
          userId,
        );
        pro.audit(db, p, null, partnerId, "partner.activated");
        return { id: partnerId };
      }
      if (kind === "leads" && id) {
        if (!p.admin) pro.fail("Acces interzis.", 403);
        if (
          !["in_review", "qualified", "rejected", "converted"].includes(
            String(b.status),
          )
        )
          pro.fail("Stare invalidă.");
        db.prepare("UPDATE pro_leads SET status=?,note=? WHERE id=?").run(
          b.status,
          pro.text(b.note, "Notă", 2000),
          id,
        );
        pro.audit(db, p, null, id, "lead.review");
        return { id };
      }
      if (kind === "notifications" && id) {
        const notification = db.prepare("SELECT * FROM pro_notifications WHERE id=? AND user_id=?")
          .get(id, p.id) as pro.NotificationTarget | undefined;
        if (!notification || !pro.notificationAllowed(db, p, notification))
          pro.fail("Notificare indisponibilă.", 404);
        db.prepare(
          "UPDATE pro_notifications SET read_at=? WHERE id=? AND user_id=?",
        ).run(new Date().toISOString(), id, p.id);
        return { id };
      }
      if (kind === "invites" && !id) {
        const org = pro.text(b.organization_id, "Organizație");
        pro.requireRole(db, p, org, ["owner"]);
        if (
          !["manager", "approver", "viewer", "contact"].includes(String(b.role))
        )
          pro.fail("Rol invalid.");
        const email = pro.text(b.email, "Email").toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          pro.fail("Email invalid.");
        const scope = Array.isArray(b.scope) ? b.scope : [];
        if (["viewer", "contact"].includes(String(b.role)) && !scope.length)
          pro.fail("Selectează proprietățile accesibile.");
        for (const pid of scope)
          pro.property(db, p, pro.text(pid, "Proprietate"));
        if (
          scope.some(
            (pid) =>
              !db
                .prepare(
                  "SELECT 1 FROM pro_properties WHERE id=? AND organization_id=?",
                )
                .get(String(pid), org),
          )
        )
          pro.fail("Proprietate din altă organizație.");
        const token = randomBytes(32).toString("hex"),
          inviteId = randomUUID();
        db.prepare(
          "INSERT INTO pro_invites(id,organization_id,email,role,scope_json,token_hash,expires_at) VALUES(?,?,?,?,?,?,?)",
        ).run(
          inviteId,
          org,
          email,
          b.role,
          JSON.stringify(scope),
          createHash("sha256").update(token).digest("hex"),
          new Date(Date.now() + 72 * 3600000).toISOString(),
        );
        pro.audit(db, p, org, inviteId, "invite.created");
        return { id: inviteId, invite_path: "/pro/echipa#invite=" + token };
      }
      if (kind === "invites" && id === "accept") {
        if (p.admin || !emailIsVerified(db, p.id))
          pro.fail("Confirmă emailul contului înainte de acceptare.", 403);
        const token = pro.text(b.token, "Invitație");
        const invite = db
          .prepare(
            "SELECT i.* FROM pro_invites i JOIN users u ON lower(u.email)=i.email WHERE i.token_hash=? AND u.id=? AND i.used_at IS NULL AND i.revoked=0 AND i.expires_at>?",
          )
          .get(
            createHash("sha256").update(token).digest("hex"),
            p.id,
            new Date().toISOString(),
          ) as
          | {
              id: string;
              organization_id: string;
              role: string;
              scope_json: string;
            }
          | undefined;
        if (!invite) pro.fail("Invitație indisponibilă.", 404);
        db.prepare(
          "INSERT INTO pro_members VALUES(?,?,?,?,?,1) ON CONFLICT(organization_id,user_id,role) DO UPDATE SET active=1,scope_json=excluded.scope_json",
        ).run(
          randomUUID(),
          invite.organization_id,
          p.id,
          invite.role,
          invite.scope_json,
        );
        db.prepare("UPDATE pro_invites SET used_at=? WHERE id=?").run(
          new Date().toISOString(),
          invite.id,
        );
        pro.audit(db, p, invite.organization_id, invite.id, "invite.accepted");
        return { id: invite.organization_id };
      }
      if (kind === "members" && id) {
        const m = db.prepare("SELECT * FROM pro_members WHERE id=?").get(id) as
          pro.Member | undefined;
        if (!m) pro.fail("Membru inexistent.", 404);
        pro.requireRole(db, p, m.organization_id, ["owner"]);
        if (m.role === "owner")
          pro.fail("Transferul titularului se gestionează separat.", 409);
        db.prepare("UPDATE pro_members SET active=0 WHERE id=?").run(id);
        pro.audit(db, p, m.organization_id, id, "member.revoked");
        return { id };
      }
      pro.fail("Acțiune inexistentă.", 404);
    });
    return json(result);
  } catch (e) {
    return error(e);
  }
}
