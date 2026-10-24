import { describe,expect,it,vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeMarketingEmailChecks,marketingEmailDomain,verifyMarketingEmail } from './adminMarketingEmailVerification';
describe('technical verification without sending messages',()=>{
 it('rejects malformed and private/test domains',()=>{for(const email of ['bad','x@@firm.ro','x@localhost','x@firm.local','x@example.com','x@-firm.ro'])expect(marketingEmailDomain(email)).toBeNull();expect(marketingEmailDomain('Office@Nitido.ro')).toBe('nitido.ro');});
 it('requires both public-source evidence and MX, caching a shared domain across addresses',async()=>{
  const db=new Database(':memory:');initializeMarketingEmailChecks(db);db.prepare("INSERT INTO marketing_email_checks(email,source_status) VALUES(?,'verified')").run('office@nitido.ro');db.prepare("INSERT INTO marketing_email_checks(email,source_status) VALUES(?,'pending')").run('info@nitido.ro');const reader=vi.fn(async()=>({state:'mx' as const,reason:'PUBLIC_MX_PRESENT'}));
  expect((await verifyMarketingEmail(db,'office@nitido.ro',reader))?.status).toBe('verified');expect((await verifyMarketingEmail(db,'info@nitido.ro',reader))?.status).toBe('needs_review');expect(reader).toHaveBeenCalledOnce();db.close();
 });
 it('keeps a domain without explicit MX unconfirmed and rejects a null-MX verdict',async()=>{
  for(const state of ['implicit_a','invalid'] as const){const db=new Database(':memory:');initializeMarketingEmailChecks(db);db.prepare("INSERT INTO marketing_email_checks(email,source_status) VALUES('x@nitido.ro','verified')").run();expect((await verifyMarketingEmail(db,'x@nitido.ro',async()=>({state,reason:'test'})))?.status).toBe(state==='invalid'?'invalid':'needs_review');db.close();}
 });
});
