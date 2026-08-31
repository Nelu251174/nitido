import Twilio from "twilio";

export function toE164Romania(phone: string): string | null {
  const digits = phone.trim().replace(/[^\d+]/g, "");
  let normalized: string;
  if (/^\+40\d{9}$/.test(digits)) normalized = digits;
  else if (/^0\d{9}$/.test(digits)) normalized = `+4${digits}`;
  else if (/^40\d{9}$/.test(digits)) normalized = `+${digits}`;
  else if (/^\d{9}$/.test(digits)) normalized = `+40${digits}`;
  else return null;
  return /^\+40[237]\d{8}$/.test(normalized) ? normalized : null;
}

export function smsProviderConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export async function sendSmsViaTwilio(to: string, body: string): Promise<{ providerMessageId: string }> {
  if (!smsProviderConfigured()) throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
  const client = Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!, { timeout: 10_000 });
  const message = await client.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER!, body });
  return { providerMessageId: message.sid };
}
