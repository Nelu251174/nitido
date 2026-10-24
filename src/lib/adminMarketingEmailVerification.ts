import { Resolver } from 'node:dns/promises';
import { domainToASCII } from 'node:url';
import type { Database } from 'better-sqlite3';
import { initializeMarketing } from './adminMarketing';
import { isPublicAddress } from './adminMarketingPublicWeb';
export type DomainVerdict={state:'mx'|'implicit_a'|'invalid'|'temporary';reason:string};
export type DomainReader=(domain:string)=>Promise<DomainVerdict>;
export function marketingEmailDomain(email:string){
 const parts=email.trim().toLowerCase().split('@');
 if(parts.length!==2||!parts[0]||parts[0].length>64||email.length>254||/[\s<>\",;]/.test(email))return null;
 const domain=domainToASCII(parts[1]);
 if(!domain||domain.length>253||!domain.includes('.')||domain.split('.').some(p=>!p||p.length>63||!/[a-z0-9]$/.test(p)||!/^[a-z0-9]/.test(p)||!/^[a-z0-9-]+$/.test(p))||/(^|\.)(localhost|local|internal|invalid|test|example|onion)$/.test(domain)||/^(example\.(com|net|org))$/.test(domain))return null;
 return domain;
}
/** DNS only. Never opens an SMTP connection or sends a message. */
export const readMarketingMailDomain:DomainReader=async domain=>{
 const resolver=new Resolver({timeout:4000,tries:1});
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([
   (async():Promise<DomainVerdict>=>{
    try{
     const mx=await resolver.resolveMx(domain);
     if(mx.some(r=>r.exchange==='.'||r.exchange===''))return {state:'invalid',reason:'DOMAIN_NULL_MX'};
     if(mx.some(r=>r.exchange.includes('.')&&!/(^|\.)(local|internal|localhost|invalid|onion)$/i.test(r.exchange)))return {state:'mx',reason:'PUBLIC_MX_PRESENT'};
    }catch(error){if(!['ENODATA','ENOTFOUND'].includes(String((error as NodeJS.ErrnoException).code)))return {state:'temporary',reason:'DNS_UNAVAILABLE'};}
    const addresses=await Promise.allSettled([resolver.resolve4(domain),resolver.resolve6(domain)]);
    const values=addresses.flatMap(result=>result.status==='fulfilled'?result.value:[]);
    if(values.some(isPublicAddress))return {state:'implicit_a',reason:'NO_EXPLICIT_MX'};
    if(values.length)return {state:'invalid',reason:'DOMAIN_NOT_PUBLIC'};
    if(addresses.some(result=>result.status==='rejected'&&!['ENODATA','ENOTFOUND'].includes(String((result.reason as NodeJS.ErrnoException)?.code))))return {state:'temporary',reason:'DNS_UNAVAILABLE'};
    return {state:'invalid',reason:'DOMAIN_NOT_FOUND'};
   })(),
   new Promise<DomainVerdict>(resolve=>{timer=setTimeout(()=>{resolver.cancel();resolve({state:'temporary',reason:'DNS_TIMEOUT'});},6000);timer.unref();}),
  ]);
 }finally{if(timer)clearTimeout(timer);resolver.cancel();}
};
export function initializeMarketingEmailChecks(db:Database){
 initializeMarketing(db);
 db.exec("CREATE TABLE IF NOT EXISTS marketing_domain_checks(domain TEXT PRIMARY KEY,state TEXT NOT NULL,reason TEXT NOT NULL,checked_at TEXT NOT NULL,expires_at TEXT NOT NULL)");
}
export async function verifyMarketingEmail(db:Database,email:string,reader:DomainReader=readMarketingMailDomain){
 initializeMarketingEmailChecks(db);
 const row=db.prepare('SELECT source_status,attempts FROM marketing_email_checks WHERE email=?').get(email) as {source_status:string;attempts:number}|undefined;
 if(!row)return null;
 const domain=marketingEmailDomain(email);let verdict:DomainVerdict;
 if(!domain)verdict={state:'invalid',reason:'EMAIL_SYNTAX_OR_DOMAIN_INVALID'};
 else{
  const cached=db.prepare('SELECT state,reason FROM marketing_domain_checks WHERE domain=? AND expires_at>?').get(domain,new Date().toISOString()) as DomainVerdict|undefined;
  verdict=cached??await reader(domain);
  if(!cached){const checked=new Date().toISOString(),expires=new Date(Date.now()+(verdict.state==='temporary'?5*60000:7*86400000)).toISOString();db.prepare('INSERT INTO marketing_domain_checks VALUES(?,?,?,?,?) ON CONFLICT(domain) DO UPDATE SET state=excluded.state,reason=excluded.reason,checked_at=excluded.checked_at,expires_at=excluded.expires_at').run(domain,verdict.state,verdict.reason,checked,expires);}
 }
 const attempts=row.attempts+1;
 const status=verdict.state==='invalid'?'invalid':verdict.state==='mx'&&row.source_status==='verified'?'verified':verdict.state==='temporary'&&attempts<3?'pending':'needs_review';
 const next=status==='pending'?new Date(Date.now()+5*60000).toISOString():null;
 db.prepare('UPDATE marketing_email_checks SET status=?,syntax_ok=?,domain_status=?,reason=?,checked_at=?,next_attempt_at=?,attempts=? WHERE email=?').run(status,domain?1:0,verdict.state,verdict.reason,new Date().toISOString(),next,attempts,email);
 return {email,status,domain:verdict.state};
}
