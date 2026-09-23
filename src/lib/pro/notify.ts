import { sendEmail } from "@/lib/email";

export function proNotifyEmail(): string {
  return process.env.PRO_LEAD_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || "contact@nitido.ro";
}

export async function notifyProLead(input: {
  id: string;
  kind: "client" | "partner";
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
}) {
  const to = proNotifyEmail();
  const subject = `NITIDO Pro · cerere ${input.kind} · ${input.name}`;
  const html = `<p>Cerere nouă NITIDO Pro (${input.kind}).</p>
<p><b>Nume:</b> ${escapeHtml(input.name)}<br/>
<b>Telefon:</b> ${escapeHtml(input.phone ?? "—")}<br/>
<b>Email:</b> ${escapeHtml(input.email ?? "—")}<br/>
<b>Zonă:</b> ${escapeHtml(input.city ?? "—")}<br/>
<b>ID:</b> ${escapeHtml(input.id)}</p>
<p>Deschide <a href="https://nitido.ro/admin/pro-leads">/admin/pro-leads</a></p>
<p>Dacă RESEND_API_KEY lipsește, acest mesaj nu a fost trimis din producție.</p>`;
  return sendEmail({ to, subject, html });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}
