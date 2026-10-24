import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { emailConfigured, sendEmail } from '@/lib/email';
import { issueAdminPasswordReset, activateAdminPasswordReset, discardAdminPasswordReset, consumeAdminRecoveryLimit } from '@/lib/adminPasswordReset';
import { adminRecoveryGuard, adminRecoveryReply, readAdminRecoveryBody } from '@/lib/adminRecoveryHttp';

const generic = { ok: true, message: 'Cererea a fost procesată. Dacă adresa corespunde unui administrator activ și mesajul poate fi trimis, vei primi linkul de recuperare. Verifică Inbox și Spam.' };
export async function POST(req: NextRequest) {
  const denied = adminRecoveryGuard(req, 'request'); if (denied) return denied;
  const body = await readAdminRecoveryBody(req);
  if (typeof body?.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return adminRecoveryReply({ error: 'Introdu o adresă de email validă.' }, 400);
  if (!emailConfigured()) return adminRecoveryReply({ error: 'Recuperarea prin email este temporar indisponibilă. Contactează administratorul infrastructurii.' }, 503);
  let issued: ReturnType<typeof issueAdminPasswordReset> = null;
  try {
    if (!consumeAdminRecoveryLimit(db, 'request-global', 40, 15 * 60000)) return adminRecoveryReply(generic);
    issued = issueAdminPasswordReset(db, body.email.trim().toLowerCase());
    if (issued) {
      const link = new URL('/admin/recuperare', new URL(process.env.NEXT_PUBLIC_SITE_URL!).origin); link.hash = issued.token;
      const accepted = await sendEmail({ to: issued.email, subject: 'Recuperare parolă ADMIN — NITIDO',
        html: `<h2>Recuperare parolă ADMIN NITIDO</h2><p>Ai solicitat o parolă nouă pentru panoul de administrare NÍTIDO.</p><p><a href="${link.href}">Setează parola nouă</a></p><p>Linkul este valabil 15 minute și poate fi folosit o singură dată. Ai nevoie și de codul din aplicația de autentificare sau de un cod de recuperare 2FA.</p><p>Dacă nu ai cerut schimbarea, ignoră mesajul. Parola curentă rămâne valabilă.</p>` });
      if (!accepted || !activateAdminPasswordReset(db, issued.token)) discardAdminPasswordReset(db, issued.token);
    }
  } catch {
    if (issued) { try { discardAdminPasswordReset(db, issued.token); } catch { /* No credential or delivery data in logs. */ } }
  }
  return adminRecoveryReply(generic);
}
