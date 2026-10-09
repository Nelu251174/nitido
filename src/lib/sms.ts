import Twilio from "twilio";

export class SmsProviderError extends Error {}

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
  if (!smsProviderConfigured()) throw new SmsProviderError("SMS_PROVIDER_NOT_CONFIGURED");
  const client = Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!, { timeout: 10_000 });
  try{
    const message = await client.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER!, body });
    if(!message.sid)throw new Error("DELIVERY_UNKNOWN");
    return { providerMessageId: message.sid };
  }catch(error){
    const status=typeof error==='object'&&error!==null&&'status' in error?Number(error.status):0;
    if(status>=400&&status<500&&status!==408)throw new SmsProviderError("SMS_PROVIDER_REJECTED");
    throw new Error("DELIVERY_UNKNOWN");
  }
}
