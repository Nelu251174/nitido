import Twilio from "twilio";

/**
 * Notificări SMS — trei fluxuri, în ordinea firească a unei lucrări:
 * 1. Către firmele eligibile dintr-un oraș, când un client postează o lucrare
 *    nouă — sendNewJobAlertSms.
 * 2. Către client, INSTANT când o firmă acceptă lucrarea lui — sendJobAcceptedSms.
 * 3. Către client, când firma confirmă sosirea la locație ("Am ajuns / Lucrare
 *    începută") — sendArrivalSms.
 *
 * Interimar, cât timp aplicația mobilă (singura sursă de notificări push reale)
 * nu e publicată în App Store/Google Play — până atunci, nici firma, nici
 * clientul n-ar afla nimic fără să aibă pagina deschisă activ în browser
 * (polling). SMS-ul acoperă golul pe toate cele trei momente.
 *
 * Feature-flag pe `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`:
 * dacă oricare lipsește din mediu, funcțiile nu fac nimic (no-op) — restul
 * fluxului rămâne complet funcțional fără cont Twilio. De îndată ce cheile
 * sunt puse, SMS-urile chiar pleacă, fără nicio altă schimbare de cod.
 */

function getTwilioClient(): Twilio.Twilio | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return Twilio(sid, token);
}

/** Trimite un singur SMS; eșuează silențios (doar log) — nu trebuie să blocheze fluxul de business. */
async function sendSms(to: string | null, body: string): Promise<void> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!client || !from || !to) return;

  const normalizedTo = toE164Romania(to);
  if (!normalizedTo) return;

  try {
    await client.messages.create({ to: normalizedTo, from, body });
  } catch (err) {
    console.error("Trimitere SMS eșuată:", err instanceof Error ? err.message : err);
  }
}

/**
 * Normalizează un număr de telefon românesc la formatul internațional E.164 (+40...),
 * cerut de Twilio. Acceptă formate uzuale: 07xxxxxxxx, 7xxxxxxxx, +407xxxxxxxx.
 */
export function toE164Romania(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+4${digits}`;
  if (digits.startsWith("40")) return `+${digits}`;
  if (digits.length === 9) return `+40${digits}`;
  return null;
}

/**
 * Trimite SMS-ul de confirmare de acceptare către client — instant, în
 * momentul în care o firmă apasă "Accept lucrarea" (nu la sosire, e un
 * moment distinct, mai devreme în flux).
 */
export async function sendJobAcceptedSms(params: {
  clientPhone: string | null;
  firmName: string;
  street: string;
  city: string;
}): Promise<void> {
  const body = `Nitido: Firma ${params.firmName} a acceptat lucrarea ta de la ${params.street}, ${params.city}. Urmărește statusul în cont.`;
  await sendSms(params.clientPhone, body);
}

/**
 * Trimite SMS-ul de sosire către client — "am ajuns / sunt jos".
 */
export async function sendArrivalSms(params: {
  clientPhone: string | null;
  firmName: string;
  street: string;
  city: string;
}): Promise<void> {
  const body = `Nitido: Echipa de curățenie (${params.firmName}) a ajuns la ${params.street}, ${params.city}. Sunt jos / la locație.`;
  await sendSms(params.clientPhone, body);
}

const SPACE_TYPE_LABELS: Record<string, string> = {
  apartament: "apartament",
  casa: "casă",
  birou: "birou",
  altul: "spațiu",
};

/**
 * Trimite SMS-ul de alertă "lucrare nouă" către o listă de firme dintr-un
 * oraș — trimise în paralel, fiecare eșec e izolat (nu oprește trimiterea
 * către celelalte firme). Apelantul (POST /api/jobs) nu așteaptă finalizarea
 * — vezi folosirea acolo.
 */
export async function sendNewJobAlertSms(
  firmPhones: (string | null)[],
  job: { city: string; spaceType: string; sqm: number }
): Promise<void> {
  const spaceLabel = SPACE_TYPE_LABELS[job.spaceType] ?? "spațiu";
  const body = `Nitido: Lucrare nouă în ${job.city} — ${spaceLabel}, ${job.sqm} mp. Prima firmă care acceptă o câștigă. Intră în cont acum.`;
  await Promise.all(firmPhones.map((phone) => sendSms(phone, body)));
}
