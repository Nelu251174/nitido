import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {EMAIL_VERIFICATION_SCHEMA,issueEmailVerification,confirmEmailVerification,emailIsVerified,sendVerificationEmail,sendVerificationEmailResult} from './emailVerification';
import {EMAIL_DELIVERY_DIAGNOSTIC_SCHEMA,emailDiagnostics} from './emailDeliveryDiagnostics';
let db:Database.Database;
beforeEach(()=>{db=new Database(':memory:');db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT)');db.exec(EMAIL_VERIFICATION_SCHEMA);db.exec(EMAIL_DELIVERY_DIAGNOSTIC_SCHEMA);db.exec("INSERT INTO users VALUES('a','a@example.com'),('b','b@example.com')");vi.spyOn(console,'info').mockImplementation(()=>{})});afterEach(()=>{db.close();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks()});
it('stores only a hash and consumes a token once',()=>{const issued=issueEmailVerification(db,'a',100);const row=db.prepare('SELECT token_hash FROM email_verifications').get() as {token_hash:string};expect(row.token_hash).not.toBe(issued.token);expect(confirmEmailVerification(db,issued.token,101)).toBe(true);expect(emailIsVerified(db,'a')).toBe(true);expect(emailIsVerified(db,'b')).toBe(false);expect(confirmEmailVerification(db,issued.token,102)).toBe(false)});
it('rejects expired malformed and replaced tokens',()=>{const old=issueEmailVerification(db,'a',100);const fresh=issueEmailVerification(db,'a',200);expect(confirmEmailVerification(db,old.token,201)).toBe(false);expect(confirmEmailVerification(db,'bad',201)).toBe(false);expect(confirmEmailVerification(db,fresh.token,200+86400000)).toBe(false);expect(emailIsVerified(db,'a')).toBe(false)});
it('binds verification to the email snapshot',()=>{const issued=issueEmailVerification(db,'a',100);db.exec("UPDATE users SET email='changed@example.com' WHERE id='a'");expect(confirmEmailVerification(db,issued.token,101)).toBe(false);const fresh=issueEmailVerification(db,'a',102);expect(confirmEmailVerification(db,fresh.token,103)).toBe(true);db.exec("UPDATE users SET email='again@example.com' WHERE id='a'");expect(emailIsVerified(db,'a')).toBe(false)});
it('does not create a token when email is unconfigured',async()=>{vi.stubEnv('RESEND_API_KEY','');vi.stubEnv('RESEND_FROM','');expect(await sendVerificationEmail(db,'a')).toBe(false);expect(db.prepare('SELECT COUNT(*) n FROM email_verifications').get()).toEqual({n:0})});
it('rejects insecure site URL before sending or issuing',async()=>{vi.stubEnv('RESEND_API_KEY','test');vi.stubEnv('RESEND_FROM','test@example.com');vi.stubEnv('NEXT_PUBLIC_SITE_URL','http://example.com');expect(await sendVerificationEmail(db,'a')).toBe(false);expect(db.prepare('SELECT COUNT(*) n FROM email_verifications').get()).toEqual({n:0})});

function configureSending(){vi.stubEnv('RESEND_API_KEY','test-placeholder');vi.stubEnv('RESEND_FROM','mail@example.com');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://example.com')}
it('preserves the previous usable link when the provider refuses a resend',async()=>{
 configureSending();const previous=issueEmailVerification(db,'a');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));
 expect(await sendVerificationEmail(db,'a')).toBe(false);
 expect(confirmEmailVerification(db,previous.token)).toBe(true);
});
it('does not leave an unusable first token after a network failure',async()=>{
 configureSending();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 expect(await sendVerificationEmail(db,'a')).toBe(false);
 expect(db.prepare('SELECT COUNT(*) n FROM email_verifications').get()).toEqual({n:0});
});
it('a failed earlier send cannot replace a newer verification token',async()=>{
 configureSending();let latest='';vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>{latest=issueEmailVerification(db,'a').token;return {ok:false}}));
 expect(await sendVerificationEmail(db,'a')).toBe(false);
 expect(confirmEmailVerification(db,latest)).toBe(true);
});
it('a failure response cannot undo a confirmation during sending',async()=>{
 configureSending();vi.stubGlobal('fetch',vi.fn().mockImplementation(async(_url,options)=>{const html=JSON.parse(options.body).html as string;const token=html.match(/#([a-f0-9]{64})/)![1];expect(confirmEmailVerification(db,token)).toBe(true);return {ok:false}}));
 expect(await sendVerificationEmail(db,'a')).toBe(false);
 expect(emailIsVerified(db,'a')).toBe(true);
});
it('returns failure instead of throwing when the account is already verified',async()=>{
 configureSending();const issued=issueEmailVerification(db,'a');confirmEmailVerification(db,issued.token);const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 expect(await sendVerificationEmail(db,'a')).toBe(false);expect(fetch).not.toHaveBeenCalled();expect(emailIsVerified(db,'a')).toBe(true);
});
it('records only technical acceptance metadata without recipient, token, body or key',async()=>{
 configureSending();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})));
 const result=await sendVerificationEmailResult(db,'a');expect(result.accepted).toBe(true);
 const diagnostic=emailDiagnostics(db);expect(diagnostic.counts.accepted).toBe(1);expect(diagnostic.items[0].messageId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');expect(diagnostic.deliveryConfirmed).toBe(false);
 const serialized=JSON.stringify([diagnostic,vi.mocked(console.info).mock.calls]);expect(serialized).not.toContain('a@example.com');expect(serialized).not.toContain('test-placeholder');expect(serialized).not.toContain('confirma-email');expect(serialized).not.toContain('token_hash');
});
it('separates invalid configuration/site/token failures before contacting the provider',async()=>{
 configureSending();const transport=vi.fn();vi.stubGlobal('fetch',transport);
 vi.stubEnv('RESEND_FROM','bad sender');expect(await sendVerificationEmailResult(db,'a')).toMatchObject({stage:'configuration',category:'invalid_sender'});
 vi.stubEnv('RESEND_FROM','mail@example.com');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://user:password@example.com');expect(await sendVerificationEmailResult(db,'a')).toMatchObject({stage:'site',category:'invalid_site'});
 vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://example.com');expect(await sendVerificationEmailResult(db,'missing')).toMatchObject({stage:'verification',category:'token_issue_failed'});
 expect(transport).not.toHaveBeenCalled();expect(db.prepare('SELECT COUNT(*) n FROM email_verifications').get()).toEqual({n:0});
});
it('keeps the new identity independent from a removed account using the same address',async()=>{
 configureSending();const old=issueEmailVerification(db,'a');db.exec("CREATE TABLE admin_removed_accounts(user_id TEXT PRIMARY KEY);INSERT INTO admin_removed_accounts VALUES('a');INSERT INTO users VALUES('new','a@example.com')");
 expect(confirmEmailVerification(db,old.token)).toBe(false);expect(()=>issueEmailVerification(db,'a')).toThrow();
 const fresh=issueEmailVerification(db,'new');expect(confirmEmailVerification(db,fresh.token)).toBe(true);expect(emailIsVerified(db,'new')).toBe(true);expect(emailIsVerified(db,'a')).toBe(false);
});
it('cannot downgrade accepted email or account creation when diagnostic storage is unavailable',async()=>{
 configureSending();db.exec('DROP TABLE email_delivery_diagnostics');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})));
 expect(await sendVerificationEmailResult(db,'a')).toMatchObject({accepted:true});expect(vi.mocked(console.info).mock.calls[0][1]).toMatchObject({diagnosticStored:false});
});
