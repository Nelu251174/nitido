/**
 * Trimitere email prin Resend (API REST, fără dependințe npm).
 * Feature-flag pe RESEND_API_KEY + RESEND_FROM: fără ele, sendEmail e no-op
 * și întoarce false (restul aplicației funcționează, doar emailul nu pleacă).
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
