import {randomUUID} from 'node:crypto';

export type EmailOptions = {to:string;subject:string;html:string;idempotencyKey?:string};
export type EmailResult = {
  accepted:boolean;
  stage:'configuration'|'site'|'verification'|'provider'|'transport';
  category:'not_configured'|'invalid_sender'|'invalid_site'|'token_issue_failed'|'provider_accepted'|'provider_unauthorized'|'provider_forbidden'|'provider_rate_limited'|'provider_unavailable'|'provider_rejected'|'transport_timeout'|'transport_error';
  correlationId:string;
  httpStatus:number|null;
  messageId:string|null;
  attempts:number;
  retryAfterSeconds:number|null;
};

/** Only opaque IDs are allowed into diagnostics, never arbitrary provider text. */
export function emailTechnicalId(value:unknown):string|null {
  return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)?value:null;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export function emailSenderValid(from=process.env.RESEND_FROM??''):boolean {
  if(/[\r\n]/.test(from))return false;
  const address=from.match(/<([^<>]+)>\s*$/)?.[1]??from.trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address);
}

export function emailFailure(category:EmailResult['category'],stage:EmailResult['stage'],correlationId:string=randomUUID()):EmailResult {
  return {accepted:false,stage,category,correlationId:emailTechnicalId(correlationId)??randomUUID(),httpStatus:null,messageId:null,attempts:0,retryAfterSeconds:null};
}

/** Provider acceptance is not evidence of delivery. No provider error body is read or logged. */
export async function sendEmailResult(opts:EmailOptions,control:{correlationId?:string;retryTransient?:boolean}={}):Promise<EmailResult> {
  const correlationId=emailTechnicalId(control.correlationId)??randomUUID();
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return emailFailure('not_configured','configuration',correlationId);
  if (!emailSenderValid(from)) return emailFailure('invalid_sender','configuration',correlationId);
  const signal=AbortSignal.timeout(8000);
  // Legacy callers never acquire extra sends. Only opted-in, idempotent sends may retry once.
  const maxAttempts=control.retryTransient&&opts.idempotencyKey?2:1;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.idempotencyKey?{'Idempotency-Key':opts.idempotencyKey}:{}) },
        body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
      });
      const httpStatus=Number.isInteger(res.status)&&res.status>=100&&res.status<=599?res.status:null;
      if(res.ok){
        let messageId:string|null=null;
        try{const body:unknown=await res.json();if(body&&typeof body==='object'&&'id' in body)messageId=emailTechnicalId(body.id)}catch{/* A malformed receipt does not justify sending an accepted email twice. */}
        return {accepted:true,stage:'provider',category:'provider_accepted',correlationId,httpStatus,messageId,attempts:attempt,retryAfterSeconds:null};
      }
      const category:EmailResult['category']=httpStatus===401?'provider_unauthorized':httpStatus===403?'provider_forbidden':httpStatus===429?'provider_rate_limited':httpStatus!==null&&httpStatus>=500?'provider_unavailable':'provider_rejected';
      const retryHeader=res.headers?.get('retry-after');
      const retryAfterSeconds=retryHeader&&/^\d{1,5}$/.test(retryHeader)?Math.min(Number(retryHeader),3600):null;
      // Do not inspect the provider error text: it can contain addresses, request data or credentials.
      try{await res.body?.cancel()}catch{/* Closing the body must not alter the technical result. */}
      if(attempt<maxAttempts&&(httpStatus===429||(httpStatus!==null&&httpStatus>=500))&&(retryAfterSeconds===null||retryAfterSeconds<=1)&&!signal.aborted){
        await new Promise<void>(resolve=>setTimeout(resolve,retryAfterSeconds===null?250:retryAfterSeconds*1000));
        continue;
      }
      return {accepted:false,stage:'provider',category,correlationId,httpStatus,messageId:null,attempts:attempt,retryAfterSeconds};
    } catch(error) {
      const timeout=signal.aborted||(error instanceof Error&&['AbortError','TimeoutError'].includes(error.name));
      return {...emailFailure(timeout?'transport_timeout':'transport_error','transport',correlationId),attempts:attempt};
    }
  }
  return emailFailure('transport_error','transport',correlationId);
}

/** Compatibility for current transactional flows: true means HTTP acceptance only. */
export async function sendEmail(opts:EmailOptions):Promise<boolean> {
  return (await sendEmailResult(opts)).accepted;
}
